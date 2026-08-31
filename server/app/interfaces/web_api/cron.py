"""定时扫描端点（R1-R4）：云函数 pay-cron 薄壳经 X-Cron-Token 调用，不暴露公网登录态。

设计依据：backend-detail-design.md §5.3（R1-R4）/ §4.6 / §4.7 / §4.10-4.11 / §4.13。
幂等：四个 handler 全部是幂等扫描（重放安全）。
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, Request

from app.config import settings
from app.interfaces.deps import get_db

r = APIRouter(tags=["cron"])

logger = logging.getLogger("app.cron")


def _guard(token: str) -> dict | None:
    """CRON_TOKEN 未配置 = 拒绝（fail-closed）；不匹配 = 拒绝。"""
    if not settings.CRON_TOKEN or token != settings.CRON_TOKEN:
        return {"code": 403, "msg": "cron token invalid"}
    return None


@r.post("/api/cron/scan-orders")
async def cron_scan_orders(
    request: Request, db=Depends(get_db), x_cron_token: str = Header(default=""),
):
    """R1（每 2 分钟）：T1 超时关单（先查单，迟付复活）+ 冷静期到点提交（§4.9b）。"""
    deny = _guard(x_cron_token)
    if deny:
        return deny

    from app.application.payments.refund_flow import cooldown_submit
    from app.application.payments.scan_orders import scan_timeout_close
    from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo

    gateway = request.app.state.payment_gateway
    order_repo = OrderRepo(db)
    event_repo = TradeEventRepo(db)
    from app.infrastructure.repositories.factory import code_repo as _code_repo_factory
    code_repo = _code_repo_factory(db)

    closed = scan_timeout_close(order_repo, event_repo, gateway, code_repo=code_repo)

    # 冷静期到点：CAS 赢的才提交（与用户取消竞态，先到者赢）
    submitted = 0
    for order in order_repo.find_cooldown_expired(datetime.now(timezone.utc)):
        result = cooldown_submit(order_repo, event_repo, gateway, order)
        if result.get("status") == "refund_processing" or result.get("skipped"):
            submitted += 1

    logger.info("event=cron.r1 closed=%d submitted=%d", len(closed), submitted)
    return {"code": 0, "data": {"closed": len(closed), "cooldown_submitted": submitted}}


@r.post("/api/cron/scan-repairs")
async def cron_scan_repairs(
    request: Request, db=Depends(get_db), x_cron_token: str = Header(default=""),
):
    """R2（每 2 分钟）：T2 paid 未 fulfilled 补偿发货。"""
    deny = _guard(x_cron_token)
    if deny:
        return deny

    from app.application.payments.scan_orders import scan_paid_unfulfilled
    from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo

    from app.infrastructure.repositories.factory import code_repo as _code_repo_factory
    repaired = scan_paid_unfulfilled(OrderRepo(db), TradeEventRepo(db), _code_repo_factory(db))
    logger.info("event=cron.r2 repaired=%d", len(repaired))
    return {"code": 0, "data": {"repaired": len(repaired)}}


@r.post("/api/cron/scan-refunds")
async def cron_scan_refunds(
    request: Request, db=Depends(get_db), x_cron_token: str = Header(default=""),
):
    """R3（每 5 分钟）：T3 退款跟进（NOT_ENOUGH 重试/查结果/ABNORMAL 告警）+ 扫描 D 半截恢复。"""
    deny = _guard(x_cron_token)
    if deny:
        return deny

    from app.application.payments.scan_orders import scan_refund_followup
    from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo

    gateway = request.app.state.payment_gateway
    notify = getattr(request.app.state, "notify_service", None)
    actions = scan_refund_followup(OrderRepo(db), TradeEventRepo(db), gateway, notify=notify)
    logger.info("event=cron.r3 actions=%d", len(actions))
    return {"code": 0, "data": {"actions": len(actions)}}


@r.post("/api/cron/daily-reconcile")
async def cron_daily_reconcile(
    request: Request, db=Depends(get_db), x_cron_token: str = Header(default=""),
):
    """R4（每日 07:00 北京）：T4 日对账（mock 网关记 skipped）。"""
    deny = _guard(x_cron_token)
    if deny:
        return deny

    from app.application.payments.reconcile import daily_reconcile
    from app.infrastructure.repositories.payments_repo import (
        OrderRepo,
        ReconciliationReportRepo,
        TradeEventRepo,
    )

    gateway = request.app.state.payment_gateway
    notify = getattr(request.app.state, "notify_service", None)
    out = daily_reconcile(
        db, gateway, OrderRepo(db), TradeEventRepo(db), ReconciliationReportRepo(db),
        notify=notify,
    )
    logger.info("event=cron.r4 bill_date=%s status=%s", out["bill_date"], out["status"])
    return {"code": 0, "data": out}
