"""create_order：下单用例。

冻结快照 + 三态开关校验 + 协议留痕 + pending 复用。
设计依据：backend-detail-design.md §4.1。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.domain.payments.pricing import (
    AgreementStaleError, PurchaseDisabledError, SkuNotFoundError,
    calc_price_fen, gen_order_no,
)
from app.infrastructure.payments.gateway import PaymentGateway, PaymentResult
from app.infrastructure.repositories.payments_repo import OrderRepo, SkuRepo, TradeEventRepo

ORDER_TTL_SECONDS = 900  # 15 分钟
AGREEMENT_VERSION = "v2026.08"


def create_order(
    order_repo: OrderRepo,
    sku_repo: SkuRepo,
    event_repo: TradeEventRepo,
    gateway: PaymentGateway,
    user_id: int,
    sku_key: str,
    agreement_version: str,
    purchase_enabled: str = "off",
    rehearsal_usernames: list[str] | None = None,
    caller_username: str = "",
    rng=None,
) -> dict:
    """下单（冻结快照 + 统一下单 + pending 复用）。

    Returns:
        {order_no, amount_fen, code_url, status, expires_at, ttl_seconds}
    """
    now = datetime.now(timezone.utc)

    # ── 三态开关校验 ──
    if purchase_enabled == "off":
        raise PurchaseDisabledError()
    if purchase_enabled == "rehearsal":
        if caller_username not in (rehearsal_usernames or []):
            raise PurchaseDisabledError()

    # ── 协议版本校验 ──
    if agreement_version != AGREEMENT_VERSION:
        raise AgreementStaleError()

    # ── SKU 查找与快照 ──
    sku = sku_repo.find_by_key(sku_key)
    if not sku or not sku.get("on_sale", False):
        raise SkuNotFoundError(sku_key)

    price_fen = calc_price_fen(sku["base_price_fen"], sku["discount_permille"])
    snapshot = {
        "tier_key": sku.get("tier_key", "pro"),
        "tier_display": sku.get("tier_display", sku.get("tier_key", "PRO")),
        "period": sku["period"],
        "period_days": sku["period_days"],
        "base_price_fen": sku["base_price_fen"],
        "discount_permille": sku["discount_permille"],
        "device_limit": sku.get("device_limit", 1),
    }

    # ── pending 复用（同 SKU 未过期单） ──
    existing_pending = order_repo.find_by_user(user_id, limit=5)
    for order in existing_pending:
        if (order.get("status") == "pending"
                and order.get("prepay_status") != "failed"
                and order.get("sku_id") == sku.get("id")
                and order.get("code_url")):
            # pg_http 行的 created_at 是 ISO 字符串，先归一为 datetime 再运算
            created = order["created_at"]
            if isinstance(created, str):
                from app.infrastructure.repositories.pg_http.client import parse_dt
                created = parse_dt(created)
            # 复用已有 pending 单（返回其二维码）
            return {
                "order_no": order["order_no"],
                "amount_fen": order["amount_fen"],
                "code_url": order["code_url"],
                "status": "pending",
                "expires_at": (created + timedelta(seconds=ORDER_TTL_SECONDS)).isoformat(),
                "ttl_seconds": ORDER_TTL_SECONDS,
            }

    # ── 新建订单 ──
    order_no = gen_order_no(now, rng=rng)
    attach = f"{caller_username}|{sku_key}"

    order_doc = {
        "order_no": order_no,
        "user_id": user_id,
        "sku_id": sku["id"],
        "sku_snapshot": snapshot,
        "amount_fen": price_fen,
        "status": "pending",
        "prepay_status": "none",
        "channel": "wxpay",
        "agreement_version": agreement_version,
        "agreed_at": now,
        "created_at": now,
    }
    created = order_repo.create(order_doc)

    # ── 统一下单（获取 code_url）──
    result: PaymentResult = gateway.create_payment(
        out_trade_no=order_no,
        amount_fen=price_fen,
        description=f"爱小说 PRO · {snapshot['period']}",
        attach=attach,
        notify_url="",  # 由调用方（接口层）注入
    )

    if result.success:
        order_repo.update_fields(order_no, {
            "code_url": result.code_url,
            "prepay_status": "created",
            "attach_sent": attach,
        })
    else:
        order_repo.update_fields(order_no, {"prepay_status": "failed"})

    # ── 审计事件 ──
    event_repo.append({
        "event_key": f"order:{order_no}:created",
        "event_type": "order.created",
        "order_no": order_no,
        "payload": {"sku_key": sku_key, "amount_fen": price_fen, "attach": attach},
        "operator": f"user:{caller_username}",
        "created_at": now,
    })

    return {
        "order_no": order_no,
        "amount_fen": price_fen,
        "code_url": result.code_url if result.success else "",
        "status": "pending",
        "expires_at": (now + timedelta(seconds=ORDER_TTL_SECONDS)).isoformat(),
        "ttl_seconds": ORDER_TTL_SECONDS,
    }
