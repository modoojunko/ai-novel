"""PaymentGateway Protocol + MockPaymentGateway。

设计依据：backend-detail-design.md §6。
接口通道无关（不含品牌名）；Mock 为 Change 1 全链路替身。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Protocol, runtime_checkable


class PaymentStatus(str, Enum):
    """归一化支付状态（跨通道统一）。"""
    SUCCESS = "SUCCESS"
    NOTPAY = "NOTPAY"
    CLOSED = "CLOSED"
    REFUND = "REFUND"        # 转入退款（微信 trade_state 枚举，显式归一防对账误判）
    PAYERROR = "PAYERROR"  # 用户余额不足/取消等
    UNKNOWN = "UNKNOWN"


class RefundStatus(str, Enum):
    SUCCESS = "SUCCESS"
    PROCESSING = "PROCESSING"
    NOT_ENOUGH = "NOT_ENOUGH"  # 商户账户余额不足（不自愈，官方语义）
    ABNORMAL = "ABNORMAL"      # 终态异常（原路退卡失败），官方指定商户平台人工处置
    CLOSED = "CLOSED"
    UNKNOWN = "UNKNOWN"


@dataclass
class PaymentResult:
    """create_payment 归一化返回。"""
    success: bool
    code_url: str = ""           # 二维码内容
    error_kind: str = ""          # prepay_failed / timeout


@dataclass
class QueryResult:
    """query_payment 归一化返回。"""
    status: PaymentStatus
    transaction_id: str = ""
    payer_openid: str = ""


@dataclass
class CloseResult:
    """close_payment 归一化返回。"""
    success: bool
    already_paid: bool = False   # 关单时发现已付（→ 转发货）


@dataclass
class RefundGatewayResult:
    """create_refund 归一化返回。

    error_kind（受理失败时的分类，空串=受理成功）：
    retryable=原退款单号间隔重试；manual=告警转人工不自动重试；
    network/unknown=网络或未归类异常。
    """
    status: RefundStatus
    wx_refund_id: str = ""
    error_kind: str = ""
    error_code: str = ""


@dataclass
class RefundQueryResult:
    """query_refund 归一化返回。error_kind=not_found 表示微信侧查无此退款单
    （受理丢失信号，调用方应告警而非当作处理中干等）。"""
    status: RefundStatus
    wx_refund_id: str = ""
    error_kind: str = ""


@dataclass
class BillLine:
    """归一化账单行（download_bill 返回）。"""
    out_trade_no: str
    transaction_id: str
    amount_fen: int
    status: str  # SUCCESS / REFUND / REVOKED
    success_time: str


@runtime_checkable
class PaymentGateway(Protocol):
    """通道无关支付网关接口——上层用例只依赖此接口。

    实现类：WechatPayGateway（微信，Change 2）/ AlipayGateway（预留）/ MockPaymentGateway（测试）。
    """

    def create_payment(
        self, out_trade_no: str, amount_fen: int, description: str, attach: str,
        notify_url: str,
    ) -> PaymentResult: ...

    def query_payment(self, out_trade_no: str) -> QueryResult: ...

    def close_payment(self, out_trade_no: str) -> CloseResult: ...

    def create_refund(
        self, out_refund_no: str, out_trade_no: str,
        refund_fen: int, total_fen: int, reason: str, notify_url: str,
    ) -> RefundGatewayResult: ...

    def query_refund(self, out_refund_no: str) -> RefundQueryResult: ...

    def download_bill(self, bill_date: str) -> list[BillLine]: ...


# ═══ MockPaymentGateway（Change 1 全链路替身）═══

@dataclass
class MockPaymentGateway:
    """进程内可脚本控制的测试替身。

    状态机：orders dict {out_trade_no → state dict}；
    测试通过直接操作 `gw.orders` / `gw.refunds` 控制行为。
    """

    orders: dict[str, dict[str, Any]] = field(default_factory=dict)
    refunds: dict[str, dict[str, Any]] = field(default_factory=dict)

    # ── 脚本控制钩子 ──
    next_query_status: PaymentStatus = PaymentStatus.NOTPAY
    next_refund_status: RefundStatus = RefundStatus.SUCCESS
    next_close_result: CloseResult = field(default_factory=lambda: CloseResult(success=True))
    bill_lines: list[BillLine] = field(default_factory=list)

    def create_payment(
        self, out_trade_no: str, amount_fen: int, description: str, attach: str,
        notify_url: str,
    ) -> PaymentResult:
        self.orders[out_trade_no] = {
            "amount_fen": amount_fen,
            "attach": attach,
            "status": "NOTPAY",
            "transaction_id": "",
        }
        return PaymentResult(success=True, code_url=f"weixin://mock/{out_trade_no}")

    def query_payment(self, out_trade_no: str) -> QueryResult:
        order = self.orders.get(out_trade_no)
        if not order:
            return QueryResult(status=PaymentStatus.UNKNOWN)
        status = PaymentStatus(order.get("status", "NOTPAY"))
        return QueryResult(
            status=status,
            transaction_id=order.get("transaction_id", ""),
            payer_openid=order.get("payer_openid", ""),
        )

    def close_payment(self, out_trade_no: str) -> CloseResult:
        order = self.orders.get(out_trade_no)
        if not order:
            return CloseResult(success=False)
        if order.get("status") == "SUCCESS":
            return CloseResult(success=False, already_paid=True)
        order["status"] = "CLOSED"
        return self.next_close_result

    def create_refund(
        self, out_refund_no: str, out_trade_no: str,
        refund_fen: int, total_fen: int, reason: str, notify_url: str,
    ) -> RefundGatewayResult:
        self.refunds[out_refund_no] = {
            "order_no": out_trade_no,
            "amount_fen": refund_fen,
            "status": self.next_refund_status.value,
        }
        return RefundGatewayResult(
            status=self.next_refund_status,
            wx_refund_id=f"mock_refund_{out_refund_no}",
        )

    def query_refund(self, out_refund_no: str) -> RefundQueryResult:
        refund = self.refunds.get(out_refund_no)
        if not refund:
            return RefundQueryResult(status=RefundStatus.UNKNOWN)
        return RefundQueryResult(
            status=RefundStatus(refund.get("status", "PROCESSING")),
            wx_refund_id=refund.get("wx_refund_id", ""),
        )

    def download_bill(self, bill_date: str) -> list[BillLine]:
        return self.bill_lines

    # ── 测试辅助方法（非接口）──

    def simulate_paid(self, out_trade_no: str, transaction_id: str = "", openid: str = "") -> None:
        """测试注入：标记订单已付。"""
        if out_trade_no in self.orders:
            self.orders[out_trade_no]["status"] = "SUCCESS"
            self.orders[out_trade_no]["transaction_id"] = transaction_id or f"mock_tx_{out_trade_no}"
            self.orders[out_trade_no]["payer_openid"] = openid or "mock_openid"

    def simulate_refund_success(self, out_refund_no: str) -> None:
        """测试注入：标记退款成功。"""
        if out_refund_no in self.refunds:
            self.refunds[out_refund_no]["status"] = "SUCCESS"

    def simulate_payerror(self, out_trade_no: str) -> None:
        """测试注入：余额不足/取消。"""
        if out_trade_no in self.orders:
            self.orders[out_trade_no]["status"] = "PAYERROR"
