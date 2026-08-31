"""R1-R4 定时扫描端点测试：token 守卫（fail-closed）+ mock 网关下四端点可走通。"""
from __future__ import annotations

import pytest

from app.config import settings

TOKEN = "test-cron-token-1234"


@pytest.fixture
def _cron_token(monkeypatch):
    monkeypatch.setattr(settings, "CRON_TOKEN", TOKEN)


def _post(client, path: str, token: str = TOKEN):
    return client.post(path, headers={"X-Cron-Token": token})


class TestCronGuard:
    def test_no_token_configured_rejects(self, client, monkeypatch):
        monkeypatch.setattr(settings, "CRON_TOKEN", "")
        r = client.post("/api/cron/scan-orders", headers={"X-Cron-Token": "anything"})
        assert r.json()["code"] == 403

    def test_wrong_token_rejects(self, client, _cron_token):
        r = client.post("/api/cron/scan-orders", headers={"X-Cron-Token": "wrong"})
        assert r.json()["code"] == 403

    def test_missing_header_rejects(self, client, _cron_token):
        r = client.post("/api/cron/scan-orders")
        assert r.json()["code"] == 403


class TestCronEndpoints:
    def test_r1_scan_orders(self, client, _cron_token):
        r = _post(client, "/api/cron/scan-orders")
        assert r.status_code == 200
        body = r.json()
        assert body["code"] == 0
        assert "closed" in body["data"] and "cooldown_submitted" in body["data"]

    def test_r2_scan_repairs(self, client, _cron_token):
        r = _post(client, "/api/cron/scan-repairs")
        assert r.status_code == 200
        assert r.json()["data"]["repaired"] >= 0

    def test_r3_scan_refunds(self, client, _cron_token):
        r = _post(client, "/api/cron/scan-refunds")
        assert r.status_code == 200
        assert r.json()["data"]["actions"] >= 0

    def test_r4_daily_reconcile_mock_skipped(self, client, _cron_token):
        r = _post(client, "/api/cron/daily-reconcile")
        assert r.status_code == 200
        assert r.json()["data"]["status"] == "skipped"
