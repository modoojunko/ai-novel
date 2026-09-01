"""check-auth A4 扩展测试：days_remaining + attention（C端到期提示条数据源）。

设计依据：backend-detail-design.md §1 check-auth 扩展。
向后兼容：无支付数据时新字段省略。
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.models.base import SessionLocal
from app.models.code import ActivationCodeORM
from app.models.payments import OrderORM
from app.models.user import UserORM
from tests.test_device_activation import seed_grant_row, seed_raw_user


def _seed_active_code(username: str, tier: str = "monthly", days: int = 30):
    """插一条已激活 code（license.max_expires_at 来源）。"""
    s = SessionLocal()
    try:
        u = s.query(UserORM.id).filter(UserORM.username == username).first()
        uid = u[0]
        s.add(ActivationCodeORM(
            code_id=f"CODE-{username}",
            tier=tier,
            duration_days=days,
            status="active",
            user_id=uid,
            activated_at=datetime.now() - timedelta(days=1),
            expires_at=datetime.now() + timedelta(days=days - 1),
        ))
        s.commit()
    finally:
        s.close()


def _seed_order(order_no: str, username: str, **overrides):
    s = SessionLocal()
    try:
        u = s.query(UserORM.id).filter(UserORM.username == username).first()
        base = dict(
            order_no=order_no,
            user_id=u[0],
            sku_id=1,
            sku_snapshot={"tier_key": "pro", "period": "monthly", "period_days": 30,
                          "base_price_fen": 3000, "discount_permille": 1000,
                          "device_limit": 3},
            amount_fen=3000,
            status="fulfilled",
            prepay_status="created",
            agreement_version="v2026.08",
            agreed_at=datetime.now(),
            channel="wxpay",
            refund_status="none",
        )
        base.update(overrides)
        s.add(OrderORM(**base))
        s.commit()
    finally:
        s.close()


@pytest.fixture
def _authed_user(client):
    """建用户+设备 grant（已授权态），返回 (username, pc_hash)。"""
    import uuid
    username = f"ckext_{uuid.uuid4().hex[:8]}"
    seed_raw_user(username)
    pc_hash = f"ckext-{uuid.uuid4().hex[:8]}"
    seed_grant_row(pc_hash, username, enrolled=1)
    return username, pc_hash


def _check_auth(client, pc_hash: str) -> dict:
    r = client.get("/api/check-auth", params={"pc_hash": pc_hash})
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 0
    return body["data"]


class TestCheckAuthExtension:
    def test_free_user_no_extra_fields(self, client, _authed_user):
        username, pc_hash = _authed_user
        data = _check_auth(client, pc_hash)
        assert "days_remaining" not in data
        assert "attention" not in data

    def test_days_remaining_present_with_active_code(self, client, _authed_user):
        username, pc_hash = _authed_user
        _seed_active_code(username)
        data = _check_auth(client, pc_hash)
        assert "days_remaining" in data
        assert 0 < data["days_remaining"] <= 30

    def test_attention_verify_pending_on_exception_order(self, client, _authed_user):
        username, pc_hash = _authed_user
        _seed_active_code(username)
        _seed_order("CKEX1", username, status="exception", paid_at=datetime.now())
        data = _check_auth(client, pc_hash)
        assert data["attention"]["verify_pending"] is True
        assert data["attention"]["refund_processing"] is False

    def test_attention_refund_processing_on_cooldown(self, client, _authed_user):
        username, pc_hash = _authed_user
        _seed_active_code(username)
        _seed_order("CKEX2", username, status="refund_pending",
                    refund_status="cooldown",
                    cooldown_ends_at=datetime.now() + timedelta(minutes=3),
                    refund_amount_fen=1500)
        data = _check_auth(client, pc_hash)
        assert data["attention"]["refund_processing"] is True
        assert data["attention"]["verify_pending"] is False
