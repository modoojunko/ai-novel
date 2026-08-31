"""领域层测试：状态机转移穷举 + 折算验证向量 + 定价 + tier 归属 + merge。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.domain.payments.order import (
    ALL_STATUSES, CLOSED, EXCEPTION, FULFILLED, PAID, PENDING,
    REFUNDED, REFUND_PENDING, REFUND_PROCESSING,
    InvalidTransition, can_transition, next_status,
)
from app.domain.payments.pricing import (
    calc_price_fen, gen_order_no, normalize_tier, resolve_effective_tier,
)
from app.domain.payments.refund import (
    REASON_BELOW_ONE_FEN, REASON_OVER_ONE_YEAR,
    calc_refund_fen,
)
from app.domain.licensing.license import License

UTC = timezone.utc


# ═══ 状态机转移穷举 ═══

class TestStateMachine:
    LEGAL = [
        (PENDING, "payment_confirmed", PAID),
        (PAID, "delivery_complete", FULFILLED),
        (PENDING, "timeout_close", CLOSED),
        (PENDING, "amount_mismatch", EXCEPTION),
        (FULFILLED, "refund_requested", REFUND_PENDING),
        (REFUND_PENDING, "refund_canceled", FULFILLED),
        (REFUND_PENDING, "cooldown_expired", REFUND_PROCESSING),
        (REFUND_PENDING, "refund_succeeded", REFUNDED),
        (REFUND_PROCESSING, "refund_succeeded", REFUNDED),
        (REFUND_PROCESSING, "admin_offline_settled", REFUNDED),
        (REFUND_PROCESSING, "admin_abandon_unfreeze", FULFILLED),
        (EXCEPTION, "admin_full_refund", REFUNDED),
    ]

    def test_all_legal_transitions(self):
        for from_s, trigger, to_s in self.LEGAL:
            assert next_status(from_s, trigger) == to_s, f"{from_s} --{trigger}--> {to_s}"

    def test_closed_revival(self):
        """closed → paid 复活：payment_confirmed 的 CAS 条件含 closed。"""
        from app.domain.payments.order import get_transition
        t = get_transition(PENDING, "payment_confirmed")
        assert "closed" in t.cas_where

    def test_all_illegal_rejected(self):
        for from_s in ALL_STATUSES:
            for trigger in ["payment_confirmed", "delivery_complete", "timeout_close",
                           "refund_requested", "refund_canceled"]:
                if not any(from_s == f and trigger == tr for f, tr, _ in self.LEGAL):
                    assert not can_transition(from_s, trigger), f"{from_s} --{trigger}--> should be illegal"

    def test_invalid_transition_raises(self):
        with pytest.raises(InvalidTransition):
            next_status(REFUNDED, "payment_confirmed")  # 终态不可再转


# ═══ 折算纯函数（9 验证向量）═══

class TestCalcRefundFen:
    """验证向量：手工计算 + 手册/原型数字互证。"""

    def _t(self, days_ago=0):
        return datetime(2026, 8, 29, 12, 0, 0, tzinfo=UTC) - timedelta(days=days_ago)

    def test_v1_normal_prorated(self):
        """月卡 ¥24.00，用了 20.3 天（剩 9.7 天=838,080秒）→ 退 ¥7.76"""
        paid = self._t() - timedelta(days=20, hours=7, minutes=12)  # 20.3 天前
        grant_start = paid
        expires = grant_start + timedelta(days=30)
        q = calc_refund_fen(2400, 30*86400, expires, grant_start, self._t(), paid)
        assert q.refundable
        assert q.refund_fen == 776  # ¥7.76

    def test_v2_unactivated_full_refund(self):
        """未激活（grant_start=None）→ 全额退"""
        paid = self._t(200)
        q = calc_refund_fen(36500, 365*86400, self._t() + timedelta(days=365), None, self._t(), paid)
        assert q.refundable
        assert q.refund_fen == 36500  # 全额

    def test_v3_queued_full_refund(self):
        """排队中（grant_start 在未来）→ 全额退"""
        paid = self._t(10)
        grant_start = self._t() + timedelta(days=80)  # 80 天后才开始
        q = calc_refund_fen(29200, 365*86400,
                           grant_start + timedelta(days=365), grant_start, self._t(), paid)
        assert q.refundable
        assert q.refund_fen == 29200  # 全额

    def test_v4_below_one_fen(self):
        """剩余极短 → 不足 1 分拒退"""
        paid = self._t(30)
        grant_start = paid
        expires = self._t() + timedelta(minutes=1)  # 只剩 1 分钟
        q = calc_refund_fen(2400, 30*86400, expires, grant_start, self._t(), paid)
        assert not q.refundable
        assert q.reason == REASON_BELOW_ONE_FEN

    def test_v5_expired_no_refund(self):
        """已到期 → 不可退"""
        paid = self._t(31)
        grant_start = paid
        expires = self._t() - timedelta(days=1)  # 昨天到期
        q = calc_refund_fen(2400, 30*86400, expires, grant_start, self._t(), paid)
        assert not q.refundable

    def test_v6_over_one_year(self):
        """超 1 年窗口 → 拒退"""
        paid = self._t(366)
        grant_start = paid
        expires = grant_start + timedelta(days=365)
        q = calc_refund_fen(2400, 30*86400, expires, grant_start, self._t(), paid)
        assert not q.refundable
        assert q.reason == REASON_OVER_ONE_YEAR

    def test_v7_price_doubled(self):
        """月卡 ¥48.00 同样剩余 9.7 天 → 退款翻倍 ¥15.52"""
        paid = self._t() - timedelta(days=20, hours=7, minutes=12)
        grant_start = paid
        expires = grant_start + timedelta(days=30)
        q = calc_refund_fen(4800, 30*86400, expires, grant_start, self._t(), paid)
        assert q.refundable
        assert q.refund_fen == 1552  # ¥15.52 = ¥7.76 × 2

    def test_v8_capped_at_amount(self):
        """封顶：退款不超过实付"""
        paid = self._t(0)
        grant_start = paid
        expires = grant_start + timedelta(days=365)
        q = calc_refund_fen(100, 365*86400, expires, grant_start, self._t(), paid)
        assert q.refundable
        assert q.refund_fen <= 100

    def test_v9_yearcard_100days(self):
        """年卡 ¥365.00 用了 100 天整 → 退 ¥265.00"""
        paid = self._t(100)
        grant_start = paid
        expires = grant_start + timedelta(days=365)
        q = calc_refund_fen(36500, 365*86400, expires, grant_start, self._t(), paid)
        assert q.refundable
        assert q.refund_fen == 26500  # ¥265.00


# ═══ 定价 ═══

class TestPricing:
    def test_calc_price(self):
        assert calc_price_fen(36500, 800) == 29200  # ¥365 × 8折 = ¥292
        assert calc_price_fen(3000, 1000) == 3000   # 原价
        assert calc_price_fen(9000, 900) == 8100    # ¥90 × 9折 = ¥81

    def test_order_no_format(self):
        now = datetime(2026, 8, 29, tzinfo=UTC)
        no = gen_order_no(now)
        assert no.startswith("S20260829-")
        assert len(no) == 26
        hex_part = no.split("-")[1]
        assert len(hex_part) == 16
        int(hex_part, 16)  # 合法 hex

    def test_order_no_injectable_rng(self):
        """测试可注入 rng 模拟撞号。"""
        class FixedRng:
            def token_hex(self, n):
                return "0" * (n * 2)
        now = datetime(2026, 8, 29, tzinfo=UTC)
        assert gen_order_no(now, FixedRng()) == "S20260829-0000000000000000"


# ═══ tier 归属 ═══

class TestTierAttribution:
    def test_legacy_alias(self):
        assert normalize_tier("monthly") == "pro"
        assert normalize_tier("yearly") == "pro"
        assert normalize_tier("pro") == "pro"

    def test_highest_tier(self):
        codes = [
            type("C", (), {"tier": "pro", "status": "active"})(),
            type("C", (), {"tier": "max", "status": "queued"})(),
        ]
        assert resolve_effective_tier(codes) == "max"


# ═══ License.merge 改造 ═══

class TestLicenseMerge:
    def _code(self, tier, expires_at, status="active"):
        return type("C", (), {"tier": tier, "expires_at": expires_at, "status": status})()

    def test_skips_revoked(self):
        lic = License(username="u")
        codes = [
            self._code("pro", datetime(2027, 1, 1, tzinfo=UTC), "revoked"),
            self._code("trial", datetime(2026, 9, 1, tzinfo=UTC), "active"),
        ]
        lic.merge(codes)
        assert lic.effective_tier == "trial"

    def test_skips_frozen(self):
        lic = License(username="u")
        codes = [self._code("pro", datetime(2027, 1, 1, tzinfo=UTC), "frozen")]
        lic.merge(codes)
        assert lic.effective_tier == "none"

    def test_skips_pending_activation(self):
        lic = License(username="u")
        codes = [self._code("pro", None, "pending_activation")]
        lic.merge(codes)
        assert lic.effective_tier == "none"

    def test_highest_tier_not_latest_expiry(self):
        """年付（最高档）+ 月付（最晚到期）→ 取年付的 tier。"""
        lic = License(username="u")
        codes = [
            self._code("pro", datetime(2027, 1, 1, tzinfo=UTC)),      # pro 先到期
            self._code("trial", datetime(2027, 6, 1, tzinfo=UTC)),     # trial 更晚
        ]
        lic.merge(codes)
        assert lic.effective_tier == "pro"  # pro rank 20 > trial rank 10

    def test_legacy_monthly_treated_as_pro(self):
        lic = License(username="u")
        codes = [self._code("monthly", datetime(2027, 1, 1, tzinfo=UTC))]
        lic.merge(codes)
        assert lic.effective_tier == "pro"
