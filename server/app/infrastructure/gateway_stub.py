"""FakeGateway：非 Mock 类网关替身——让 T4 对账走真实三键比对分支（Mock 会被识别为 skipped）。"""
from __future__ import annotations

from app.infrastructure.payments.gateway import (
    BillLine,
    CloseResult,
    PaymentResult,
    PaymentStatus,
    QueryResult,
    RefundGatewayResult,
    RefundQueryResult,
    RefundStatus,
)


class FakeGateway:
    """只实现 download_bill 的最小替身（对账测试用）；其余方法不参与。"""

    def __init__(
        self,
        bill_lines: list[BillLine] | None = None,
        bill_error: Exception | None = None,
    ):
        self.bill_lines = bill_lines or []
        self.bill_error = bill_error

    def create_payment(self, out_trade_no, amount_fen, description, attach, notify_url):
        return PaymentResult(success=True, code_url="weixin://fake")

    def query_payment(self, out_trade_no):
        return QueryResult(status=PaymentStatus.NOTPAY)

    def close_payment(self, out_trade_no):
        return CloseResult(success=True)

    def create_refund(self, out_refund_no, out_trade_no, refund_fen, total_fen, reason, notify_url):
        return RefundGatewayResult(status=RefundStatus.SUCCESS)

    def query_refund(self, out_refund_no):
        return RefundQueryResult(status=RefundStatus.UNKNOWN)

    def download_bill(self, bill_date):
        if self.bill_error is not None:
            raise self.bill_error
        return self.bill_lines
