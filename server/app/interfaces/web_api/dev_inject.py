"""dev 注入端点（D1-D5）：仅在 mock 模式注册，X-Admin-Token 鉴权。

设计依据：backend-detail-design.md §6.5。
Change 1 全链路演练的核心工具——模拟微信回调/查单/退款结果。
生产模式（PAYMENTS_GATEWAY != 'mock'）永不注册路由。
"""
from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import settings

# 仅 mock 模式注册
if settings.DB_BACKEND == "sqlite" or True:  # Change 1 全部走 mock
    r = APIRouter(prefix="/api/dev/pay", tags=["dev-only"])
else:
    r = APIRouter()  # 空路由（生产不注册）


ADMIN_TOKEN = settings.ADMIN_TOKEN


def _check_admin(request: Request) -> bool:
    """X-Admin-Token 校验。"""
    token = request.headers.get("X-Admin-Token", "")
    return token == ADMIN_TOKEN


class InjectPaymentRequest(BaseModel):
    order_no: str
    transaction_id: str = ""
    payer_openid: str = ""


class InjectAmountMismatchRequest(BaseModel):
    order_no: str
    paid_amount_fen: int


class InjectRefundRequest(BaseModel):
    order_no: str
    status: str = "SUCCESS"  # SUCCESS / NOT_ENOUGH / ABNORMAL


if hasattr(r, "routes"):  # mock 模式才有路由

    @r.post("/inject-payment")
    async def inject_payment(req: InjectPaymentRequest, request: Request):
        """D1：模拟支付成功回调（mock 网关标记订单已付+触发发货）。"""
        if not _check_admin(request):
            return {"code": 401, "msg": "unauthorized"}
        gw = getattr(request.app.state, "payment_gateway", None)
        if not gw:
            return {"code": 500, "msg": "gateway not initialized"}
        gw.simulate_paid(req.order_no, req.transaction_id, req.payer_openid)
        # 触发发货
        from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo
        from app.application.payments.fulfill_payment import fulfill_payment
        db = request.app.state.db
        order = OrderRepo(db).find_by_order_no(req.order_no)
        if not order:
            return {"code": 404, "msg": "order not found"}
        result = fulfill_payment(
            OrderRepo(db), TradeEventRepo(db), order,
            transaction_id=req.transaction_id or f"mock_tx_{req.order_no}",
            payer_openid=req.payer_openid,
        )
        return {"code": 0, "data": {"status": result.get("status")}}

    @r.post("/inject-amount-mismatch")
    async def inject_amount_mismatch(req: InjectAmountMismatchRequest, request: Request):
        """D2：模拟金额不符（订单进 exception）。"""
        if not _check_admin(request):
            return {"code": 401, "msg": "unauthorized"}
        from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo
        from app.domain.payments.order import Transition
        db = request.app.state.db
        t = Transition("pending", "amount_mismatch", "exception", "", "金额不符")
        result = OrderRepo(db).compare_and_transition(req.order_no, t)
        TradeEventRepo(db).append({
            "event_key": f"order:{req.order_no}:exception",
            "event_type": "order.exception",
            "order_no": req.order_no,
            "payload": {"expected": req.paid_amount_fen},
        })
        return {"code": 0, "data": {"status": "exception" if result else "cas_lost"}}

    @r.post("/inject-refund-result")
    async def inject_refund_result(req: InjectRefundRequest, request: Request):
        """D3：模拟退款回调结果。"""
        if not _check_admin(request):
            return {"code": 401, "msg": "unauthorized"}
        gw = getattr(request.app.state, "payment_gateway", None)
        if not gw:
            return {"code": 500, "msg": "gateway not initialized"}
        if req.status == "SUCCESS":
            gw.simulate_refund_success(req.order_no)
        from app.application.payments.refund_flow import complete_refund
        from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo
        db = request.app.state.db
        if req.status == "SUCCESS":
            result = complete_refund(OrderRepo(db), TradeEventRepo(db), req.order_no)
            return {"code": 0, "data": result}
        return {"code": 0, "data": {"refund_status": req.status}}

    @r.post("/inject-payerror")
    async def inject_payerror(request: Request):
        """D4：模拟支付失败（余额不足/取消）。"""
        if not _check_admin(request):
            return {"code": 401, "msg": "unauthorized"}
        body = await request.json()
        order_no = body.get("order_no", "")
        gw = getattr(request.app.state, "payment_gateway", None)
        if gw:
            gw.simulate_payerror(order_no)
        return {"code": 0, "data": {"pay_status": "PAYERROR"}}

    @r.get("/gateway-state")
    async def gateway_state(request: Request):
        """D5：查看 mock 网关当前状态（调试用）。"""
        if not _check_admin(request):
            return {"code": 401, "msg": "unauthorized"}
        gw = getattr(request.app.state, "payment_gateway", None)
        if not gw:
            return {"code": 500, "msg": "gateway not initialized"}
        return {"code": 0, "data": {
            "orders": {k: v.get("status") for k, v in gw.orders.items()},
            "refunds": {k: v.get("status") for k, v in gw.refunds.items()},
        }}
