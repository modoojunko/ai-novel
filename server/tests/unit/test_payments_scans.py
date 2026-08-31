"""扫描族 + 对账 + 计税测试：T3 跟进（重试/异常/半截恢复）+ T4 三键比对 + 月度报表。"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.application.payments.reconcile import _bill_window, daily_reconcile
from app.application.payments.scan_orders import scan_refund_followup
from app.application.payments.tax_report import monthly_tax_report
from app.infrastructure.gateway_stub import FakeGateway
from app.infrastructure.notify import LoggingNotifyService
from app.infrastructure.payments.gateway import BillLine, MockPaymentGateway, RefundStatus
from app.infrastructure.repositories.payments_repo import (
    OrderRepo,
    ReconciliationReportRepo,
    TradeEventRepo,
)
from app.models.base import SessionLocal
from app.models.payments import OrderORM, ReconciliationReportORM
from app.models.user import UserORM

UTC = timezone.utc


@pytest.fixture(scope="module", autouse=True)
def _ensure_tables():
    """模块内直连 ORM 写库，需确保表已建（等价 TestClient startup 的 create_all）。"""
    from app.models.base import Base, engine
    Base.metadata.create_all(bind=engine)
    yield


def _mk_user(username: str) -> int:
    db = SessionLocal()
    try:
        u = UserORM(username=username, password_hash="x")
        db.add(u)
        db.flush()
        uid = u.id
        db.commit()
        return uid
    finally:
        db.close()


def _mk_order(order_no: str, user_id: int, **overrides) -> dict:
    """直接落一条订单（默认 fulfilled；退款态等用 overrides 改写）。"""
    base = dict(
        order_no=order_no,
        user_id=user_id,
        sku_id=1,
        sku_snapshot={"tier_key": "pro", "period": "monthly", "period_days": 30,
                      "base_price_fen": 3000, "discount_permille": 1000,
                      "device_limit": 3},
        amount_fen=3000,
        status="fulfilled",
        prepay_status="created",
        agreement_version="v2026.08",
        agreed_at=datetime.now(UTC),
        transaction_id=f"tx_{order_no}",
        channel="wxpay",
        refund_status="none",
    )
    base.update(overrides)
    db = SessionLocal()
    try:
        orm = OrderORM(**base)
        db.add(orm)
        db.commit()
        return base
    finally:
        db.close()


@pytest.fixture
def repos():
    db = SessionLocal()
    yield db, OrderRepo(db), TradeEventRepo(db), ReconciliationReportRepo(db)
    db.close()


# ═══ T3 退款跟进 ═══

class TestScanRefundFollowup:
    def test_processing_query_success_completes(self, repos):
        _, order_repo, event_repo, _ = repos
        uid = _mk_user("t3a")
        _mk_order("T3OK1", uid, status="refund_processing", refund_status="processing",
                  refund_amount_fen=1500)
        gw = MockPaymentGateway()
        gw.refunds["T3OK1"] = {"status": RefundStatus.SUCCESS.value, "wx_refund_id": "wx1"}

        out = scan_refund_followup(order_repo, event_repo, gw)
        assert {"order_no": "T3OK1", "action": "refund_completed"} in out
        row = order_repo.find_by_order_no("T3OK1")
        assert row["status"] == "refunded"
        assert row["refund_status"] == "succeeded"

    def test_not_enough_retries_and_counts(self, repos):
        _, order_repo, event_repo, _ = repos
        uid = _mk_user("t3b")
        _mk_order("T3NE1", uid, status="refund_processing", refund_status="processing",
                  refund_amount_fen=1500, refund_not_enough=0)
        gw = MockPaymentGateway()
        gw.refunds["T3NE1"] = {"status": RefundStatus.NOT_ENOUGH.value}
        gw.next_refund_status = RefundStatus.NOT_ENOUGH  # 重试仍不足

        out = scan_refund_followup(order_repo, event_repo, gw)
        assert {"order_no": "T3NE1", "action": "not_enough_retry", "attempts": 1} in out
        row = order_repo.find_by_order_no("T3NE1")
        assert row["refund_not_enough"] == 1
        assert row["status"] == "refund_processing"  # 状态不动，等下轮

    def test_not_enough_retry_then_success(self, repos):
        _, order_repo, event_repo, _ = repos
        uid = _mk_user("t3c")
        _mk_order("T3NE2", uid, status="refund_processing", refund_status="processing",
                  refund_amount_fen=1500)
        gw = MockPaymentGateway()
        gw.refunds["T3NE2"] = {"status": RefundStatus.NOT_ENOUGH.value}
        gw.next_refund_status = RefundStatus.SUCCESS  # 重试成功

        out = scan_refund_followup(order_repo, event_repo, gw)
        assert {"order_no": "T3NE2", "action": "retry_completed"} in out
        assert order_repo.find_by_order_no("T3NE2")["status"] == "refunded"

    def test_abnormal_notifies_and_holds(self, repos):
        _, order_repo, event_repo, _ = repos
        uid = _mk_user("t3d")
        _mk_order("T3AB1", uid, status="refund_processing", refund_status="processing",
                  refund_amount_fen=1500)
        gw = MockPaymentGateway()
        gw.refunds["T3AB1"] = {"status": RefundStatus.ABNORMAL.value}
        notify = LoggingNotifyService()

        out = scan_refund_followup(order_repo, event_repo, gw, notify=notify)
        assert {"order_no": "T3AB1", "action": "abnormal_notified"} in out
        assert len(notify.sent) == 1
        row = order_repo.find_by_order_no("T3AB1")
        assert row["status"] == "refund_processing"  # 状态保持，人工处置

    def test_half_done_repaired(self, repos):
        """扫描 D：退款成功但订单未标 refunded → 幂等补齐。"""
        _, order_repo, event_repo, _ = repos
        uid = _mk_user("t3e")
        _mk_order("T3HD1", uid, status="refund_processing", refund_status="succeeded",
                  refund_amount_fen=1500, refund_wx_id="wxHD")

        out = scan_refund_followup(order_repo, event_repo, MockPaymentGateway())
        assert {"order_no": "T3HD1", "action": "half_done_repaired"} in out
        assert order_repo.find_by_order_no("T3HD1")["status"] == "refunded"


# ═══ T4 日对账 ═══

def _bill_line(no: str, tx: str, fen: int) -> BillLine:
    return BillLine(out_trade_no=no, transaction_id=tx, amount_fen=fen,
                    status="SUCCESS", success_time="2026-08-30 12:00:00")


class TestDailyReconcile:
    def test_mock_gateway_records_skipped(self, repos):
        db, order_repo, event_repo, report_repo = repos
        out = daily_reconcile(db, MockPaymentGateway(), order_repo, event_repo,
                              report_repo, bill_date="2026-08-29")
        assert out["status"] == "skipped"
        assert report_repo.find_by_date("2026-08-29")["status"] == "skipped"

    def test_balanced(self, repos):
        db, order_repo, event_repo, report_repo = repos
        uid = _mk_user("rcA")
        start, _ = _bill_window("2026-08-29")
        _mk_order("RC1", uid, status="fulfilled", paid_at=start + timedelta(hours=1))
        gw = FakeGateway(bill_lines=[_bill_line("RC1", "tx_RC1", 3000)])
        notify = LoggingNotifyService()

        out = daily_reconcile(db, gw, order_repo, event_repo, report_repo,
                              notify=notify, bill_date="2026-08-29")
        assert out["status"] == "balanced"
        rep = report_repo.find_by_date("2026-08-29")
        assert rep["status"] == "balanced"
        assert rep["internal_count"] == 1 and rep["wx_count"] == 1
        assert notify.sent == []

    def test_amount_mismatch_and_wx_only(self, repos):
        db, order_repo, event_repo, report_repo = repos
        uid = _mk_user("rcB")
        start, _ = _bill_window("2026-08-28")
        _mk_order("RCB1", uid, status="fulfilled", paid_at=start + timedelta(hours=2))
        gw = FakeGateway(bill_lines=[
            _bill_line("RCB1", "tx1", 2900),   # 金额不平
            _bill_line("GHOST", "tx2", 1000),  # 微信有本地无
        ])
        notify = LoggingNotifyService()

        out = daily_reconcile(db, gw, order_repo, event_repo, report_repo,
                              notify=notify, bill_date="2026-08-28")
        assert out["status"] == "mismatch"
        kinds = {m["kind"] for m in out["mismatches"]}
        assert "amount_diff" in kinds and "wx_only" in kinds
        assert len(notify.sent) == 1
        assert "对账不平" in notify.sent[0]["title"]

    def test_rehearsal_user_excluded(self, repos, monkeypatch):
        db, order_repo, event_repo, report_repo = repos
        uid = _mk_user("rehearsal_rc")
        start, _ = _bill_window("2026-08-27")
        _mk_order("RCH1", uid, status="fulfilled", paid_at=start + timedelta(hours=1))
        monkeypatch.setattr("app.config.settings.PAYMENTS_REHEARSAL_USERNAMES",
                            "rehearsal_rc")
        gw = FakeGateway(bill_lines=[])  # 网关侧无此单，但内部账已排除 → balanced
        out = daily_reconcile(db, gw, order_repo, event_repo, report_repo,
                              bill_date="2026-08-27")
        assert out["status"] == "balanced"

    def test_download_error_records_and_notifies(self, repos):
        db, order_repo, event_repo, report_repo = repos
        gw = FakeGateway(bill_error=RuntimeError("bill unavailable"))
        notify = LoggingNotifyService()
        out = daily_reconcile(db, gw, order_repo, event_repo, report_repo,
                              notify=notify, bill_date="2026-08-26")
        assert out["status"] == "error"
        assert report_repo.find_by_date("2026-08-26")["status"] == "error"
        assert len(notify.sent) == 1

    def test_rerun_same_date_overwrites(self, repos):
        db, order_repo, event_repo, report_repo = repos
        for _ in range(2):
            daily_reconcile(db, MockPaymentGateway(), order_repo, event_repo,
                            report_repo, bill_date="2026-08-25")
        db.commit()  # 仓储只 flush；跨会话可见需显式提交
        db2 = SessionLocal()
        try:
            count = (
                db2.query(ReconciliationReportORM)
                .filter(ReconciliationReportORM.bill_date == date(2026, 8, 25))
                .count()
            )
            assert count == 1
        finally:
            db2.close()


# ═══ 月度计税报表 ═══

class TestMonthlyTaxReport:
    def test_aggregation_and_exempt_note(self, repos):
        db, order_repo, event_repo, _ = repos
        uid = _mk_user("taxA")
        _mk_order("TAX1", uid, status="fulfilled",
                  paid_at=datetime(2026, 5, 10, 4, 0, tzinfo=UTC))
        _mk_order("TAX2", uid, status="refunded", refund_status="succeeded",
                  paid_at=datetime(2026, 5, 11, 4, 0, tzinfo=UTC),
                  refunded_at=datetime(2026, 5, 12, 4, 0, tzinfo=UTC),
                  refund_amount_fen=1000)

        out = monthly_tax_report(db, order_repo, event_repo, "2026-05")
        assert out["gross_fen"] == 6000
        assert out["refund_fen"] == 1000
        assert out["net_fen"] == 5000
        assert out["pay_count"] == 2
        assert out["tax_exempt_note"] == "未超小规模免税额度"
        assert "TAX1" in out["csv"]

    def test_exception_and_closed_excluded(self, repos):
        db, order_repo, event_repo, _ = repos
        uid = _mk_user("taxB")
        _mk_order("TAXE1", uid, status="exception",
                  paid_at=datetime(2026, 7, 15, 4, 0, tzinfo=UTC))
        _mk_order("TAXC1", uid, status="closed")  # 未付关单
        out = monthly_tax_report(db, order_repo, event_repo, "2026-07")
        assert out["gross_fen"] == 0

    def test_rehearsal_excluded(self, repos, monkeypatch):
        db, order_repo, event_repo, _ = repos
        uid = _mk_user("rehearsal_tax")
        _mk_order("TAXR1", uid, status="fulfilled",
                  paid_at=datetime(2026, 6, 20, 4, 0, tzinfo=UTC))
        monkeypatch.setattr("app.config.settings.PAYMENTS_REHEARSAL_USERNAMES",
                            "rehearsal_tax")
        out = monthly_tax_report(db, order_repo, event_repo, "2026-06")
        assert out["gross_fen"] == 0
