"""theme-preferences 契约测试：白名单归一、me 出参、preferences 写入与 422。"""
from __future__ import annotations

from app.domain.identity.theme import ALLOWED_THEMES, is_valid_theme, normalize_theme
from tests.conftest import WEB_PASSWORD


class TestThemeDomainPure:
    """纯函数：白名单与归一化（不触库）。"""

    def test_default_and_teal_normalize_empty(self):
        assert normalize_theme(None) == ""
        assert normalize_theme("") == ""
        assert normalize_theme("teal") == ""      # teal = 默认的显式写法，库内存空串
        assert normalize_theme("ink") == "ink"

    def test_whitelist(self):
        for key in ("ink", "bamboo", "rouge", "wisteria", "celadon"):
            assert is_valid_theme(key)
        assert is_valid_theme("teal")
        assert not is_valid_theme("neon-pink")
        assert not is_valid_theme(None)


class TestPreferencesAPI:
    def test_me_defaults_to_teal(self, client, web_user):
        r = client.get("/api/user/me", headers={"Authorization": f"Bearer {web_user['token']}"})
        assert r.json()["code"] == 0
        assert r.json()["data"]["theme"] == "teal"

    def test_put_persists_and_me_reflects(self, client, web_user):
        r = client.put("/api/user/preferences", json={"theme": "ink"}, headers={"Authorization": f"Bearer {web_user['token']}"})
        assert r.status_code == 200
        assert r.json()["data"]["theme"] == "ink"

        me = client.get("/api/user/me", headers={"Authorization": f"Bearer {web_user['token']}"})
        assert me.json()["data"]["theme"] == "ink"

    def test_put_teal_stores_empty_wire_teal(self, client, web_user):
        r = client.put("/api/user/preferences", json={"theme": "teal"}, headers={"Authorization": f"Bearer {web_user['token']}"})
        assert r.json()["data"]["theme"] == "teal"

    def test_invalid_key_422_and_unchanged(self, client, web_user):
        client.put("/api/user/preferences", json={"theme": "bamboo"}, headers={"Authorization": f"Bearer {web_user['token']}"})
        r = client.put("/api/user/preferences", json={"theme": "neon-pink"}, headers={"Authorization": f"Bearer {web_user['token']}"})
        assert r.status_code == 422
        me = client.get("/api/user/me", headers={"Authorization": f"Bearer {web_user['token']}"})
        assert me.json()["data"]["theme"] == "bamboo", "非法值不得改动已存偏好"

    def test_unauthenticated_rejected(self, client):
        r = client.put("/api/user/preferences", json={"theme": "ink"})
        assert r.json()["code"] == 1

    def test_every_catalog_key_roundtrip(self, client, uid):
        """目录内每个 key 都能写入并被 me 读回（契约全覆盖）。"""
        username = f"theme_{uid}"
        reg = client.post("/api/web/register", json={"username": username, "password": WEB_PASSWORD, "security_question": "", "security_answer": ""})
        token = reg.json()["data"]["token"]
        for key in ALLOWED_THEMES:
            r = client.put("/api/user/preferences", json={"theme": key}, headers={"Authorization": f"Bearer {token}"})
            assert r.status_code == 200, (key, r.json())
            me = client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"})
            assert me.json()["data"]["theme"] == key
