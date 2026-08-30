"""activate_entitlement：到货-激活两段式的第二段。

设计依据：backend-detail-design.md §4.12。
"""
from __future__ import annotations

from datetime import datetime, date, timedelta, timezone

from app.domain.payments.pricing import NotActivatableError
from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo


def calc_grant_start(active_codes: list, today: date | None = None) -> date:
    """计算激活起点 = max(现有 active 行最远到期日, 今天)。复用 licensing 顺延。"""
    t = today or date.today()
    max_exp = t
    for code in active_codes:
        exp = getattr(code, "expires_at", None)
        if exp:
            exp_date = exp if isinstance(exp, date) else exp.date()
            if exp_date > max_exp:
                max_exp = exp_date
    return max_exp


def activate_entitlement(
    order_repo: OrderRepo,
    event_repo: TradeEventRepo,
    code_repo,  # CodeRepo（licensing 域，注入）
    order_no: str,
    user_id: int,
) -> dict:
    """激活：codes 行 pending_activation→active（写入 grant_start/expires_at）。

    Returns:
        {code_id, grant_start, expires_at, tier}
    """
    now = datetime.now(timezone.utc)
    order = order_repo.find_by_order_no(order_no)
    if not order:
        return {"error": "order_not_found"}

    # 找到该订单的 codes 行
    codes = code_repo.find_by_order(order.get("id") or order_no)
    if not codes:
        return {"error": "code_not_found"}

    code = codes[0] if isinstance(codes, list) else codes
    if code.get("status") not in ("pending_activation",):
        raise NotActivatableError()

    snapshot = order.get("sku_snapshot") or {}
    period_days = snapshot.get("period_days", 30)
    tier = snapshot.get("tier_key", "pro")

    # 计算顺延起点
    active_codes = code_repo.find_active_by_user(user_id)
    base = calc_grant_start(active_codes)
    grant_start = datetime(base.year, base.month, base.day, tzinfo=timezone.utc)
    expires_at = grant_start + timedelta(days=period_days)

    # CAS codes pending_activation→active
    updated = code_repo.compare_and_update(
        code["code_id"],
        from_status="pending_activation",
        to_status="active",
        changes={
            "grant_start": grant_start,
            "expires_at": expires_at,
            "activated_at": now,
        },
    )
    if not updated:
        raise NotActivatableError()

    event_repo.append({
        "event_key": f"codes:{code['code_id']}:activated",
        "event_type": "codes.activated",
        "order_no": order_no,
        "payload": {
            "grant_start": grant_start.isoformat(),
            "expires_at": expires_at.isoformat(),
            "tier": tier,
        },
    })

    return {
        "code_id": code["code_id"],
        "grant_start": grant_start.isoformat(),
        "expires_at": expires_at.isoformat(),
        "tier": tier,
    }
