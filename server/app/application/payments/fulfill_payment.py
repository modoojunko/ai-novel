"""fulfill_payment：支付确认+发货（CAS+幂等+补偿）。

设计依据：backend-detail-design.md §4.4-4.5。
表即状态机：CAS pending→paid → 幂等插 codes → CAS paid→fulfilled。
"""
from __future__ import annotations

from datetime import UTC, datetime

from app.domain.payments.order import Transition
from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo


def fulfill_payment(
    order_repo: OrderRepo,
    event_repo: TradeEventRepo,
    order: dict,
    transaction_id: str,
    payer_openid: str = "",
    paid_at: datetime | None = None,
    code_repo=None,
) -> dict:
    """支付确认 → 发货（全量可重入）。

    步骤（每步崩溃都有恢复路径——T2 补偿扫描重放本函数）：
    1. CAS pending→paid（含 closed→paid 复活）
    2. 幂等插 codes 台账行（code_id=O-{order_no} 唯一键=发货幂等键）
    3. CAS paid→fulfilled

    Returns:
        更新后的订单 dict。
    """
    now = paid_at or datetime.now(UTC)
    order_no = order["order_no"]

    # ── 步骤 1：CAS 确认支付 ──
    t1 = Transition("pending", "payment_confirmed", "paid", "", "支付确认")
    updated = order_repo.compare_and_transition(order_no, t1, extra_changes={
        "transaction_id": transaction_id,
        "payer_openid": payer_openid,
        "paid_at": now,
    })

    if updated is None:
        # CAS 输——可能已 paid（回调重试）或已 fulfilled（补偿完成）
        current = order_repo.find_by_order_no(order_no)
        if not current:
            return order  # 不可能（刚查过）
        if current["status"] in ("paid", "fulfilled"):
            updated = current  # 已确认，继续发货步骤
        else:
            return current  # 已退款/关闭等，不发货

    # 复活事件（from closed）
    if order.get("status") == "closed":
        event_repo.append({
            "event_key": f"order:{order_no}:revived",
            "event_type": "order.revived",
            "order_no": order_no,
            "payload": {"transaction_id": transaction_id},
            "created_at": now,
        })

    event_repo.append({
        "event_key": f"order:{order_no}:paid",
        "event_type": "order.paid",
        "order_no": order_no,
        "payload": {"transaction_id": transaction_id, "paid_at": now.isoformat()},
        "created_at": now,
    })

    # ── 步骤 2：幂等发货（插 codes 台账行，到货-激活两段式第一段）──
    snapshot = updated.get("sku_snapshot") or {}
    code_id = f"O-{order_no}"
    if code_repo is not None:
        created = code_repo.create_from_order(
            code_id=code_id,
            tier=snapshot.get("tier_key", "pro"),
            duration_days=snapshot.get("period_days", 30),
            user_id=updated["user_id"],
            order_id=updated.get("id"),
            now=now,
        )
    else:
        created = False  # 调用方未注入台账仓储（旧调用方兼容）——事件仍留痕
    event_repo.append({
        "event_key": f"codes:{code_id}:granted",
        "event_type": "codes.granted",
        "order_no": order_no,
        "payload": {"code_id": code_id, "tier": codes_doc_tier(snapshot), "created": created},
        "created_at": now,
    })

    # ── 步骤 3：CAS paid→fulfilled ──
    t2 = Transition("paid", "delivery_complete", "fulfilled", "", "发货完成")
    fulfilled = order_repo.compare_and_transition(order_no, t2, extra_changes={
        "fulfilled_at": now,
    })
    if fulfilled is None:
        # CAS 输——可能已 fulfilled（重试）
        current = order_repo.find_by_order_no(order_no)
        if current and current["status"] == "fulfilled":
            fulfilled = current
        else:
            return current or updated

    event_repo.append({
        "event_key": f"order:{order_no}:fulfilled",
        "event_type": "order.fulfilled",
        "order_no": order_no,
        "payload": {"code_id": code_id},
        "created_at": now,
    })

    return fulfilled


def codes_doc_tier(snapshot: dict) -> str:
    return snapshot.get("tier_key", "pro")
