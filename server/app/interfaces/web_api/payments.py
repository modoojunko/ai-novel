"""S端 支付 Web API（登录态）——附录 Z 联合契约。

设计依据：backend-detail-design.md §5.2 + 附录 Z。
Change 1 用 MockPaymentGateway；Change 2 替换真实网关。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.domain.payments.pricing import (
    AgreementStaleError, DomainError, PurchaseDisabledError,
    RefundAlreadyActiveError, RefundTooSmallError, RefundWindowExceeded,
    SkuNotFoundError,
)
from app.interfaces.deps import Db, get_db

r = APIRouter(prefix="/api/pay", tags=["payments"])


# ── DTO ──

class CreateOrderRequest(BaseModel):
    sku_key: str
    agreement_version: str


class RefundRequest(BaseModel):
    reason: str = ""


class ActivateRequest(BaseModel):
    order_no: str


# ── 端点 ──

@r.get("/skus")
async def get_skus(request: Request, db: Db = Depends(get_db)):
    """Z.2 公开端点：商品目录（登录时含 current 态）。"""
    from app.infrastructure.repositories.payments_repo import SkuRepo, TierRepo
    sku_repo = SkuRepo(db)
    tier_repo = TierRepo(db)

    skus = sku_repo.find_on_sale()
    tiers = tier_repo.find_all()

    # 三态开关
    from app.infrastructure.repositories.sql.config_repo import SqlConfigRepo
    config_repo = SqlConfigRepo(db)
    enabled = config_repo.get("payments.purchase.enabled") or "off"
    rehearsal_list = (config_repo.get("payments.rehearsal.usernames") or "").split(",")

    # 构建响应（附录 Z.4 SkusView）
    from app.domain.payments.pricing import calc_discount_display
    sku_list = []
    for s in skus:
        sku_list.append({
            "sku_key": s.get("sku_key", ""),
            "tier_key": s.get("tier_key", "pro"),
            "period": s.get("period", ""),
            "period_days": s.get("period_days", 0),
            "base_price_fen": s.get("base_price_fen", 0),
            "discount_display": calc_discount_display(s.get("discount_permille", 1000)),
            "price_fen": s.get("base_price_fen", 0) * s.get("discount_permille", 1000) // 1000,
            "device_limit": s.get("device_limit", 1),
        })

    popular = next((s["sku_key"] for s in sku_list if s.get("sku_key", "").endswith("yearly")), "")

    return {"code": 0, "data": {
        "purchase_enabled": enabled != "off",
        "agreement_version": "v2026.08",
        "tiers": [{"key": t.get("key"), "label": t.get("display_name"),
                    "is_live": t.get("status") == "live"} for t in tiers],
        "skus": sku_list,
        "popular_sku": popular,
    }}


@r.post("/orders")
async def create_order(req: CreateOrderRequest, request: Request, db: Db = Depends(get_db)):
    """Z.3 下单（冻结快照+统一下单）。"""
    username = getattr(request.state, "username", "")
    if not username:
        return {"code": 4001, "msg": "未登录"}


    from app.infrastructure.repositories.payments_repo import OrderRepo, SkuRepo, TradeEventRepo
    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo
    from app.application.payments.create_order import create_order as _create
    from app.infrastructure.payments.gateway import MockPaymentGateway

    user_repo = SqlUserRepo(db)
    user_id = user_repo.get_id(username)
    if not user_id:
        return {"code": 4001, "msg": "用户不存在"}

    gateway = getattr(request.app.state, "payment_gateway", MockPaymentGateway())

    try:
        result = _create(
            order_repo=OrderRepo(db),
            sku_repo=SkuRepo(db),
            event_repo=TradeEventRepo(db),
            gateway=gateway,
            user_id=user_id,
            sku_key=req.sku_key,
            agreement_version=req.agreement_version,
            caller_username=username,
        )
        return {"code": 0, "data": result}
    except PurchaseDisabledError:
        return {"code": 4012, "msg": "购买功能暂未开放"}
    except AgreementStaleError:
        return {"code": 4005, "msg": "协议已更新，请重新确认"}
    except SkuNotFoundError:
        return {"code": 4002, "msg": "套餐不存在或已下架"}
    except DomainError as e:
        return {"code": 4003, "msg": str(e)}


@r.get("/orders/pending")
async def get_pending_order(request: Request, db: Db = Depends(get_db)):
    """Z.3 恢复未支付订单。"""
    username = getattr(request.state, "username", "")
    if not username:
        return {"code": 4001, "msg": "未登录"}

    from app.infrastructure.repositories.payments_repo import OrderRepo
    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo
    user_id = SqlUserRepo(db).get_id(username)
    orders = OrderRepo(db).find_by_user(user_id, limit=1)
    pending = next((o for o in orders if o.get("status") == "pending" and o.get("code_url")), None)
    if pending:
        return {"code": 0, "data": {
            "order_no": pending["order_no"],
            "sku_id": pending.get("sku_id"),
            "amount_fen": pending["amount_fen"],
        }}
    return {"code": 0, "data": None}


@r.get("/orders/{order_no}")
async def get_order(order_no: str, request: Request, db: Db = Depends(get_db)):
    """Z.5 订单详情（全量：状态/时间线/单号/退款进度）。"""
    username = getattr(request.state, "username", "")
    if not username:
        return {"code": 4001, "msg": "未登录"}

    from app.infrastructure.repositories.payments_repo import OrderRepo
    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo

    order = OrderRepo(db).find_by_order_no(order_no)
    if not order:
        return {"code": 4004, "msg": "订单不存在"}

    # 属主校验（404 防枚举）
    user_id = SqlUserRepo(db).get_id(username)
    if order.get("user_id") != user_id:
        return {"code": 4004, "msg": "订单不存在"}

    return {"code": 0, "data": _order_to_detail(order)}


@r.post("/orders/{order_no}/query")
async def query_order(order_no: str, request: Request, db: Db = Depends(get_db)):
    """手动查单（"我已支付帮我查"）。"""
    username = getattr(request.state, "username", "")

    from app.infrastructure.repositories.payments_repo import OrderRepo
    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo
    from app.infrastructure.payments.gateway import MockPaymentGateway, PaymentStatus
    from app.application.payments.fulfill_payment import fulfill_payment
    from app.infrastructure.repositories.payments_repo import TradeEventRepo

    order = OrderRepo(db).find_by_order_no(order_no)
    user_id = SqlUserRepo(db).get_id(username)
    if not order or order.get("user_id") != user_id:
        return {"code": 4004, "msg": "订单不存在"}

    gateway = getattr(request.app.state, "payment_gateway", MockPaymentGateway())
    result = gateway.query_payment(order_no)

    hint = {
        PaymentStatus.SUCCESS: "SUCCESS",
        PaymentStatus.NOTPAY: "NOTPAY",
        PaymentStatus.PAYERROR: "PAYERROR",
        PaymentStatus.CLOSED: "CLOSED",
    }.get(result.status, "DEGRADED")

    if result.status == PaymentStatus.SUCCESS and order["status"] in ("pending", "paid"):
        fulfill_payment(
            OrderRepo(db), TradeEventRepo(db), order,
            transaction_id=result.transaction_id,
            payer_openid=result.payer_openid,
        )

    return {"code": 0, "data": {"hit": result.status == PaymentStatus.SUCCESS, "hint": hint}}


@r.get("/orders/{order_no}/refund-preview")
async def refund_preview(order_no: str, request: Request, db: Db = Depends(get_db)):
    """退款预览（折算金额）。"""
    username = getattr(request.state, "username", "")

    from app.infrastructure.repositories.payments_repo import OrderRepo
    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo
    from app.domain.payments.refund import calc_refund_fen
    from datetime import datetime, timezone, timedelta

    order = OrderRepo(db).find_by_order_no(order_no)
    user_id = SqlUserRepo(db).get_id(username)
    if not order or order.get("user_id") != user_id:
        return {"code": 4004, "msg": "订单不存在"}

    if order["status"] not in ("fulfilled",):
        reason = "in_progress" if "refund" in order["status"] else "not_paid"
        return {"code": 0, "data": {"refundable": False, "reason": reason}}

    now = datetime.now(timezone.utc)
    snapshot = order.get("sku_snapshot") or {}
    total_sec = snapshot.get("period_days", 30) * 86400
    grant_start = order.get("grant_start")  # 从 codes 行读
    expires = order.get("paid_at", now) + timedelta(days=snapshot.get("period_days", 30))

    quote = calc_refund_fen(
        amount_fen=order["amount_fen"],
        total_sec=total_sec,
        expires_at=expires,
        grant_start=grant_start,
        refund_at=now,
        paid_at=order.get("paid_at", now),
    )

    if not quote.refundable:
        reason_map = {"below_one_fen": "below_one_fen", "over_one_year": "over_one_year"}
        return {"code": 0, "data": {"refundable": False, "reason": reason_map.get(quote.reason, quote.reason)}}

    return {"code": 0, "data": {
        "refundable": True,
        "reason": "",
        "refund_fen": quote.refund_fen,
        "remaining_desc": quote.remaining_desc,
    }}


@r.post("/orders/{order_no}/refund")
async def request_refund(order_no: str, req: RefundRequest, request: Request, db: Db = Depends(get_db)):
    """确认退款（进入冷静期）。"""
    username = getattr(request.state, "username", "")

    from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo
    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo
    from app.application.payments.refund_flow import request_refund as _refund

    order = OrderRepo(db).find_by_order_no(order_no)
    user_id = SqlUserRepo(db).get_id(username)
    if not order or order.get("user_id") != user_id:
        return {"code": 4004, "msg": "订单不存在"}

    try:
        result = _refund(OrderRepo(db), TradeEventRepo(db), order, user_id, req.reason)
        if "error" in result:
            return {"code": 4008 if result["error"] == "below_one_fen" else 4009,
                    "msg": result["error"]}
        return {"code": 0, "data": result}
    except RefundAlreadyActiveError as e:
        return {"code": 4006, "msg": "退款已在进行中",
                "data": {"cooldown_remaining_seconds": e.cooldown_remaining}}
    except RefundTooSmallError:
        return {"code": 4008, "msg": "剩余时长不足折算"}
    except RefundWindowExceeded:
        return {"code": 4009, "msg": "已超过退款窗口"}


@r.post("/orders/{order_no}/refund/cancel")
async def cancel_refund(order_no: str, request: Request, db: Db = Depends(get_db)):
    """冷静期取消退款。"""
    username = getattr(request.state, "username", "")

    from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo
    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo
    from app.application.payments.refund_flow import cancel_refund as _cancel

    order = OrderRepo(db).find_by_order_no(order_no)
    user_id = SqlUserRepo(db).get_id(username)
    if not order or order.get("user_id") != user_id:
        return {"code": 4004, "msg": "订单不存在"}

    result = _cancel(OrderRepo(db), TradeEventRepo(db), order)
    if "error" in result:
        if result["error"] == "already_submitted":
            return {"code": 4007, "msg": "冷静期已结束，退款已提交"}
        return {"code": 4006, "msg": result["error"]}
    return {"code": 0, "data": result}


@r.post("/orders/{order_no}/cancel")
async def cancel_order(order_no: str, request: Request, db: Db = Depends(get_db)):
    """取消订单（用户主动）。"""
    username = getattr(request.state, "username", "")

    from app.infrastructure.repositories.payments_repo import OrderRepo
    from app.domain.payments.order import Transition
    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo

    order = OrderRepo(db).find_by_order_no(order_no)
    user_id = SqlUserRepo(db).get_id(username)
    if not order or order.get("user_id") != user_id:
        return {"code": 4004, "msg": "订单不存在"}

    if order["status"] != "pending":
        return {"code": 4006, "msg": "订单状态不允许取消"}

    t = Transition("pending", "timeout_close", "closed", "", "用户取消")
    result = OrderRepo(db).compare_and_transition(order_no, t, extra_changes={"closed_at": datetime.now(timezone.utc)})
    if result:
        return {"code": 0, "data": {"order_no": order_no, "status": "closed"}}
    return {"code": 4006, "msg": "取消失败"}


@r.get("/membership")
async def get_membership(request: Request, db: Db = Depends(get_db)):
    """Z.6 我的套餐总览。"""
    username = getattr(request.state, "username", "")
    if not username:
        return {"code": 4001, "msg": "未登录"}
    # 简化实现：从 codes 表聚合

    from app.infrastructure.repositories.sql.code_repo import SqlCodeRepo
    from app.domain.licensing.license import License

    code_repo = SqlCodeRepo(db)
    codes = code_repo.find_active_by_username(username)
    lic = License(username=username).merge(codes)

    from datetime import datetime
    remaining = 0
    if lic.max_expires_at:
        remaining = max(0, int((lic.max_expires_at - datetime.now()).total_seconds()))

    return {"code": 0, "data": {
        "tier": lic.effective_tier,
        "remaining_sec": remaining,
        "remaining_desc": f"{remaining // 86400} 天",
        "max_expires_at": lic.max_expires_at.isoformat() if lic.max_expires_at else None,
        "pending_count": 0,  # 待激活数量（从 codes pending_activation 统计）
    }}


@r.post("/grants/activate")
async def activate_grant(req: ActivateRequest, request: Request, db: Db = Depends(get_db)):
    """激活（到货-激活两段式第二段）。"""
    username = getattr(request.state, "username", "")
    if not username:
        return {"code": 4001, "msg": "未登录"}

    from app.infrastructure.repositories.sql.user_repo import SqlUserRepo
    from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo
    from app.infrastructure.repositories.sql.code_repo import SqlCodeRepo
    from app.application.payments.activate_entitlement import activate_entitlement

    user_id = SqlUserRepo(db).get_id(username)
    try:
        result = activate_entitlement(
            OrderRepo(db), TradeEventRepo(db), SqlCodeRepo(db),
            req.order_no, user_id,
        )
        if "error" in result:
            return {"code": 4004, "msg": result["error"]}
        return {"code": 0, "data": result}
    except DomainError as e:
        return {"code": 4012, "msg": str(e)}


# ── 辅助 ──

def _order_to_detail(order: dict) -> dict:
    """订单 dict → 附录 Z.5 OrderDetailView。"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    remaining_pay = None
    if order.get("status") == "pending" and order.get("created_at"):
        elapsed = (now - order["created_at"]).total_seconds()
        remaining_pay = max(0, int(900 - elapsed))  # 15 分钟 TTL

    refund = None
    rs = order.get("refund_status")
    if rs and rs != "none":
        cooldown = None
        if rs == "cooldown" and order.get("cooldown_ends_at"):
            cooldown = max(0, int((order["cooldown_ends_at"] - now).total_seconds()))
        refund = {
            "status": rs,
            "amount_fen": order.get("refund_amount_fen"),
            "cooldown_remaining_seconds": cooldown,
            "wx_refund_id": order.get("refund_wx_id"),
        }

    snapshot = order.get("sku_snapshot") or {}
    return {
        "order_no": order.get("order_no"),
        "status": order.get("status"),
        "sku_key": str(order.get("sku_id", "")),
        "snapshot": snapshot,
        "amount_fen": order.get("amount_fen"),
        "created_at": order.get("created_at", "").isoformat() if hasattr(order.get("created_at"), "isoformat") else str(order.get("created_at", "")),
        "paid_at": order.get("paid_at", "").isoformat() if hasattr(order.get("paid_at"), "isoformat") else str(order.get("paid_at", "") or ""),
        "agreement": {"version": order.get("agreement_version"), "agreed_at": str(order.get("agreed_at", ""))},
        "wx_transaction_id": order.get("transaction_id"),
        "remaining_pay_seconds": remaining_pay,
        "refund": refund,
    }
