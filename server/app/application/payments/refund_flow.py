"""退款三用例：request_refund（进入冷静期）+ cancel_refund（冷静期取消）+ complete_refund（退款完成）。

设计依据：backend-detail-design.md §4.9 / §4.9a / §4.9b / §4.11。
冷静期：确认→冻结+金额锁定→5 分钟倒计时→（可取消|到点自动提交）→成功→回收。
"""
from __future__ import annotations

from datetime import UTC, datetime

from app.domain.payments.order import Transition
from app.domain.payments.pricing import (
    RefundAlreadyActiveError,
    calc_cooldown_ends_at,
)
from app.domain.payments.refund import calc_refund_fen
from app.infrastructure.payments.gateway import (
    PaymentGateway,
    RefundGatewayResult,
    RefundStatus,
)
from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo


def _naive(value) -> datetime | None:
    """pg_http 行时间字段（ISO 字符串）/ datetime → naive UTC datetime。"""
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(UTC).replace(tzinfo=None)
        return value
    return None


# ═══ 取数辅助（preview / request 共用）═══

def resolve_refund_basis(code_repo, order: dict, now: datetime) -> tuple:
    """折算基准三元组 (grant_start, expires_at, paid_at)，全部 naive UTC datetime。

    - 台账 active 行有 grant_start/expires_at → 按秒折算；
    - 未激活（无 active 行）→ grant_start=None → 域函数走全额退；
    - pg_http 行的时间字段是 ISO 字符串，统一 parse_dt 归一；
    - 入参 now 若带 tzinfo 归一为 naive（域函数混比 aware/naive 会 TypeError）。
    """
    from app.infrastructure.repositories.pg_http.client import parse_dt

    now = _naive(now) or now
    grant_start = expires_at = None
    order_id = order.get("id") or order.get("order_no")
    if code_repo is not None and order.get("id") is not None:
        for r in code_repo.find_by_order(order_id):
            if r.status == "active" and r.grant_start and r.expires_at:
                grant_start = r.grant_start if isinstance(r.grant_start, datetime) else parse_dt(r.grant_start)
                expires_at = r.expires_at if isinstance(r.expires_at, datetime) else parse_dt(r.expires_at)
                break
    paid_at = order.get("paid_at") or now
    if isinstance(paid_at, str):
        paid_at = parse_dt(paid_at)
    paid_at = _naive(paid_at) or paid_at
    return grant_start, expires_at, paid_at


# ═══ request_refund（确认退款——进入冷静期）═══

def request_refund(
    order_repo: OrderRepo,
    event_repo: TradeEventRepo,
    code_repo,
    order: dict,
    user_id: int,
    reason: str = "",
) -> dict:
    """确认退款：冻结权益+锁定金额+进入 5 分钟冷静期。不提交微信。

    Returns:
        {order_no, amount_fen, refund_fen, status, cooldown_remaining_seconds}
    """
    now = datetime.utcnow()  # naive UTC（表列/域口径一致，避免 aware/naive 混比）
    order_no = order["order_no"]

    # 前置校验
    cooldown_left = _naive(order.get("cooldown_ends_at"))
    if order["status"] not in ("fulfilled",):
        if order["status"] in ("refund_pending", "refund_processing"):
            remaining = max(0, int((cooldown_left - now.replace(tzinfo=None)).total_seconds())) if cooldown_left else 0
            raise RefundAlreadyActiveError(cooldown_remaining=remaining)
        return {"error": "invalid_state", "status": order["status"]}

    # 折算（服务端算，金额此刻锁定）。基准来自台账行：未激活 → grant_start=None → 全额退。
    snapshot = order.get("sku_snapshot") or {}
    total_sec = snapshot.get("period_days", 30) * 86400
    grant_start, expires_at, paid_at = resolve_refund_basis(code_repo, order, now)
    if expires_at is None:
        expires_at = now  # 未激活/无到期信息 → 全额分支，占位不参与计算

    quote = calc_refund_fen(
        amount_fen=order["amount_fen"],
        total_sec=total_sec,
        expires_at=expires_at,
        grant_start=grant_start,
        refund_at=now,
        paid_at=paid_at,
    )
    if not quote.refundable:
        return {"error": quote.reason, "status": order["status"]}

    # 进入冷静期：CAS fulfilled→refund_pending
    t5 = Transition("fulfilled", "refund_requested", "refund_pending", "", "进入冷静期")
    cooldown_end = calc_cooldown_ends_at(now)
    updated = order_repo.compare_and_transition(order_no, t5, extra_changes={
        "refund_status": "cooldown",
        "refund_amount_fen": quote.refund_fen,
        "refund_reason": reason,
        "refund_operator": f"user:{user_id}",
        "refund_requested_at": now,
        "cooldown_ends_at": cooldown_end,
    })
    if updated is None:
        current = order_repo.find_by_order_no(order_no)
        if current and current["status"] in ("refund_pending", "refund_processing"):
            rem = max(0, int((_naive(current.get("cooldown_ends_at")) or now.replace(tzinfo=None)) - now.replace(tzinfo=None))) if current.get("cooldown_ends_at") else 0
            raise RefundAlreadyActiveError(cooldown_remaining=rem)
        return current or {"error": "cas_lost"}

    event_repo.append({
        "event_key": f"refund:{order_no}:requested",
        "event_type": "refund.requested",
        "order_no": order_no,
        "payload": {"refund_fen": quote.refund_fen, "reason": reason,
                     "remaining_desc": quote.remaining_desc},
        "created_at": now,
    })

    remaining = int((cooldown_end - now).total_seconds())
    return {
        "order_no": order_no,
        "amount_fen": order["amount_fen"],
        "refund_fen": quote.refund_fen,
        "status": "refund_pending",
        "cooldown_remaining_seconds": remaining,
    }


# ═══ cancel_refund（冷静期取消）═══

def cancel_refund(
    order_repo: OrderRepo,
    event_repo: TradeEventRepo,
    order: dict,
) -> dict:
    """冷静期取消：CAS refund_pending→fulfilled（先到者赢，与到点提交竞态）。"""
    now = datetime.utcnow()  # naive UTC（表列/域口径一致，避免 aware/naive 混比）
    order_no = order["order_no"]

    if order["status"] != "refund_pending":
        return {"error": "not_in_cooldown", "status": order["status"]}

    cooldown_end = _naive(order.get("cooldown_ends_at"))
    now_naive = now.replace(tzinfo=None)
    if cooldown_end and cooldown_end <= now_naive:
        return {"error": "cooldown_expired", "status": order["status"]}

    # CAS 竞态：先 CAS 赢单者赢
    t5c = Transition("refund_pending", "refund_canceled", "fulfilled", "", "冷静期取消")
    updated = order_repo.compare_and_transition(order_no, t5c, extra_changes={
        "refund_status": "canceled",
    })
    if updated is None:
        # CAS 输——已被到点提交（T6）
        return {"error": "already_submitted", "status": "refund_processing"}

    event_repo.append({
        "event_key": f"refund:{order_no}:canceled",
        "event_type": "refund.canceled",
        "order_no": order_no,
        "payload": {"previous_refund_fen": order.get("refund_amount_fen")},
        "created_at": now,
    })

    return {"order_no": order_no, "status": "fulfilled", "grant_restored": True}


# ═══ cooldown_submit（到点自动提交微信）═══

def cooldown_submit(
    order_repo: OrderRepo,
    event_repo: TradeEventRepo,
    gateway: PaymentGateway,
    order: dict,
) -> dict:
    """冷静期到点：CAS refund_pending→refund_processing，然后提交微信。"""
    now = datetime.utcnow()  # naive UTC（表列/域口径一致，避免 aware/naive 混比）
    order_no = order["order_no"]

    if order["status"] != "refund_pending":
        return {"error": "not_in_cooldown", "status": order["status"]}

    # CAS 竞态：与 T5c（用户取消）先到者赢
    t6 = Transition("refund_pending", "cooldown_expired", "refund_processing", "", "到点提交")
    updated = order_repo.compare_and_transition(order_no, t6, extra_changes={
        "refund_status": "processing",
    })
    if updated is None:
        # CAS 输——用户刚取消（T5c 赢了）
        return {"skipped": True, "reason": "user_canceled"}

    event_repo.append({
        "event_key": f"refund:{order_no}:cooldown_expired",
        "event_type": "refund.cooldown_expired",
        "order_no": order_no,
    })

    # 提交微信（out_refund_no = order_no）
    result: RefundGatewayResult = gateway.create_refund(
        out_refund_no=order_no,
        out_trade_no=order_no,
        refund_fen=order["refund_amount_fen"],
        total_fen=order["amount_fen"],
        reason=order.get("refund_reason", ""),
        notify_url="",
    )

    if result.status == RefundStatus.NOT_ENOUGH:
        order_repo.update_fields(order_no, {
            "refund_not_enough": (order.get("refund_not_enough") or 0) + 1,
        })
        event_repo.append({
            "event_key": f"refund:{order_no}:not_enough_{(order.get('refund_not_enough') or 0) + 1}",
            "event_type": "refund.not_enough_retry",
            "order_no": order_no,
        })
    elif result.status == RefundStatus.SUCCESS:
        # 直接进 complete_refund
        return complete_refund(order_repo, event_repo, order_no, result.wx_refund_id)
    else:
        event_repo.append({
            "event_key": f"refund:{order_no}:accepted",
            "event_type": "refund.accepted",
            "order_no": order_no,
            "payload": {"wx_refund_id": result.wx_refund_id},
        })

    return {"order_no": order_no, "status": "refund_processing"}


# ═══ complete_refund（退款成功——全量可重入）═══

def complete_refund(
    order_repo: OrderRepo,
    event_repo: TradeEventRepo,
    order_no: str,
    wx_refund_id: str = "",
) -> dict:
    """退款成功：标记 succeeded + 回收权益 + 订单→refunded。

    全量可重入：每步 CAS 输但已是目标态→继续（A2 修复）。
    """
    order = order_repo.find_by_order_no(order_no)
    if not order:
        return {"error": "not_found"}

    now = datetime.utcnow()  # naive UTC（表列/域口径一致，避免 aware/naive 混比）

    # 步骤 1：refund_status→succeeded（幂等：已 succeeded→继续）
    if order.get("refund_status") != "succeeded":
        order_repo.update_fields(order_no, {
            "refund_status": "succeeded",
            "refund_wx_id": wx_refund_id,
            "refund_accepted_at": order.get("refund_accepted_at") or now,
        })
        event_repo.append({
            "event_key": f"refund:{order_no}:succeeded",
            "event_type": "refund.succeeded",
            "order_no": order_no,
            "payload": {"wx_refund_id": wx_refund_id},
        })

    # 步骤 2：CAS 订单→refunded（幂等：已 refunded→继续）
    if order["status"] != "refunded":
        order_repo.update_fields(order_no, {
            "status": "refunded",
            "refunded_at": now,
        })
        # codes 行回收由调用方（code_repo.revoke）完成

    return {"order_no": order_no, "status": "refunded"}
