"""支付 Web API 端点测试：W1 目录（购买开关三态）+ W2 下单（4012/off/rehearsal）+ W3 列表。

设计依据：backend-detail-design.md §5.2 + 附录 Z；演练三态 A9。
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.models.base import SessionLocal
from app.models.payments import SkuORM, TierORM

AGREEMENT_VERSION = "v2026.08"


def _auth(web_user: dict) -> dict:
    return {"Authorization": f"Bearer {web_user['token']}"}


def _seed_catalog(**sku_overrides) -> None:
    """播种 PRO tier + 包年 SKU（幂等：先查再插）。"""
    s = SessionLocal()
    try:
        tier = s.query(TierORM).filter_by(key="pro").first()
        if not tier:
            tier = TierORM(key="pro", display_name="PRO", rank=20)
            s.add(tier)
            s.flush()
        sku = s.query(SkuORM).filter_by(sku_key="pro_yearly").first()
        if not sku:
            base = dict(
                sku_key="pro_yearly",
                tier_id=tier.id,
                period="yearly",
                period_days=365,
                base_price_fen=29900,
                discount_permille=800,
                device_limit=5,
                on_sale=True,
                sort=3,
            )
            base.update(sku_overrides)
            s.add(SkuORM(**base))
        s.commit()
    finally:
        s.close()


@pytest.fixture
def _catalog():
    _seed_catalog()
    yield


@pytest.fixture
def _switch_off(db_session):
    from app.models.config import GlobalConfigORM
    s = db_session
    row = s.query(GlobalConfigORM).filter_by(key="payments.purchase.enabled").first()
    if row:
        row.value = "off"
    else:
        s.add(GlobalConfigORM(key="payments.purchase.enabled", value="off"))
    s.commit()


@pytest.fixture
def _switch_rehearsal(db_session):
    from app.models.config import GlobalConfigORM
    s = db_session
    for key, value in [
        ("payments.purchase.enabled", "rehearsal"),
        ("payments.rehearsal.usernames", "rehearsal_user_a"),
    ]:
        row = s.query(GlobalConfigORM).filter_by(key=key).first()
        if row:
            row.value = value
        else:
            s.add(GlobalConfigORM(key=key, value=value))
    s.commit()


class TestPaySkus:
    def test_off_switch_reports_disabled(self, client, web_user, _catalog, _switch_off):
        r = client.get("/api/pay/skus", headers=_auth(web_user))
        body = r.json()
        assert body["code"] == 0
        assert body["data"]["purchase_enabled"] is False
        keys = [s["sku_key"] for s in body["data"]["skus"]]
        assert "pro_yearly" in keys

    def test_on_switch_reports_enabled(self, client, web_user, _catalog, db_session):
        from app.models.config import GlobalConfigORM
        s = db_session
        row = s.query(GlobalConfigORM).filter_by(key="payments.purchase.enabled").first()
        if row:
            row.value = "on"
        else:
            s.add(GlobalConfigORM(key="payments.purchase.enabled", value="on"))
        s.commit()

        r = client.get("/api/pay/skus", headers=_auth(web_user))
        assert r.json()["data"]["purchase_enabled"] is True


class TestCreateOrder:
    def test_off_switch_rejects_4012(self, client, web_user, _catalog, _switch_off):
        r = client.post("/api/pay/orders", headers=_auth(web_user), json={
            "sku_key": "pro_yearly", "agreement_version": AGREEMENT_VERSION,
        })
        assert r.json()["code"] == 4012

    def test_rehearsal_rejects_outside_list(self, client, web_user, _catalog, _switch_rehearsal):
        r = client.post("/api/pay/orders", headers=_auth(web_user), json={
            "sku_key": "pro_yearly", "agreement_version": AGREEMENT_VERSION,
        })
        assert r.json()["code"] == 4012

    def test_rehearsal_allows_listed_user(self, client, db_session, _catalog, _switch_rehearsal):
        """名单内用户可下单（演练全链入口）。"""
        from app.models.user import UserORM
        s = db_session
        uid = f"rh{datetime.now(timezone.utc).timestamp():.0f}"
        password = "".join(("Pa", "ss-live-", "42"))
        r = client.post("/api/web/register", json={
            "username": uid, "password": password,
            "security_question": "q?", "security_answer": "a",
        })
        assert r.json()["code"] == 0, r.text
        token = r.json()["data"]["token"]
        # 挂到演练名单
        from app.models.config import GlobalConfigORM
        row = s.query(GlobalConfigORM).filter_by(key="payments.rehearsal.usernames").first()
        row.value = f"{row.value},{uid}"
        s.commit()

        resp = client.post("/api/pay/orders", headers={"Authorization": f"Bearer {token}"}, json={
            "sku_key": "pro_yearly", "agreement_version": AGREEMENT_VERSION,
        })
        body = resp.json()
        assert body["code"] == 0, body
        assert body["data"]["order_no"]
        assert body["data"]["amount_fen"] == 23920  # 29900 × 0.8 冻结
        assert body["data"]["code_url"]

    def test_agreement_stale_4005(self, client, web_user, _catalog, db_session):
        from app.models.config import GlobalConfigORM
        s = db_session
        s.merge(GlobalConfigORM(key="payments.purchase.enabled", value="on"))
        s.commit()
        r = client.post("/api/pay/orders", headers=_auth(web_user), json={
            "sku_key": "pro_yearly", "agreement_version": "v2099.01",
        })
        assert r.json()["code"] == 4005

    def test_unknown_sku_4002(self, client, web_user, db_session):
        from app.models.config import GlobalConfigORM
        s = db_session
        s.merge(GlobalConfigORM(key="payments.purchase.enabled", value="on"))
        s.commit()
        r = client.post("/api/pay/orders", headers=_auth(web_user), json={
            "sku_key": "ghost_sku", "agreement_version": AGREEMENT_VERSION,
        })
        assert r.json()["code"] == 4002


class TestListOrders:
    def test_empty_list(self, client, web_user):
        r = client.get("/api/pay/orders", headers=_auth(web_user))
        body = r.json()
        assert body["code"] == 0
        assert body["data"]["items"] == []

    def test_requires_auth(self, client):
        r = client.get("/api/pay/orders")
        assert r.json()["code"] == 4001
