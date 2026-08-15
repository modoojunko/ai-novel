"""pg_http 仓储单元测试：httpx MockTransport 模拟 PostgREST，验证请求构造与领域映射。

不真实访问云端；用 MockTransport 检查 method/URL/query/body，并返回模拟 JSON。
"""
from __future__ import annotations

from datetime import date, datetime

import httpx
import pytest

from app.domain.devices import DeviceRegistry
from app.domain.identity import User
from app.domain.licensing import ActivationCode
from app.infrastructure.repositories.pg_http.client import PgRestClient
from app.infrastructure.repositories.pg_http.code_repo import PgHttpCodeRepo
from app.infrastructure.repositories.pg_http.config_repo import PgHttpConfigRepo
from app.infrastructure.repositories.pg_http.device_repo import PgHttpDeviceRepo
from app.infrastructure.repositories.pg_http.grant_repo import PgHttpGrantRepo
from app.infrastructure.repositories.pg_http.user_repo import PgHttpUserRepo

ENDPOINT = "https://env.api.tcloudbasegateway.com/v1/rdb/rest"


def make_client(handler) -> PgRestClient:
    return PgRestClient(ENDPOINT, "test-key", transport=httpx.MockTransport(handler))


def _ok(json_body: list | dict | None = None) -> httpx.Response:
    return httpx.Response(200, json=json_body if json_body is not None else [])


# ══════════════════════════════════════════════════════════════════
# PgRestClient
# ══════════════════════════════════════════════════════════════════

class TestPgRestClient:
    def test_find_builds_eq_filter_and_sort(self):
        requests: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return _ok([{"username": "alice"}])

        client = make_client(handler)
        rows = client.find(
            "users",
            {"username": "alice", "status": "active"},
            sort=[("created_at", "desc")],
            limit=5,
        )
        assert rows == [{"username": "alice"}]
        req = requests[0]
        assert req.method == "GET"
        assert req.url.path.endswith("/users")
        assert req.url.params["username"] == "eq.alice"
        assert req.url.params["status"] == "eq.active"
        assert req.url.params["order"] == "created_at.desc"
        assert req.url.params["limit"] == "5"
        assert req.headers["Authorization"] == "Bearer test-key"

    def test_find_none_value_uses_is_null(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["expires_at"] == "is.null"
            return _ok([])

        client = make_client(handler)
        assert client.find("codes", {"expires_at": None}) == []

    def test_insert_sends_null_for_none_fields(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            body = request.read().decode()
            assert '"username":"bob"' in body
            assert '"created_at":null' in body  # None → 显式 null（省略会应用列 DEFAULT）
            return httpx.Response(201)

        client = make_client(handler)
        client.insert("users", {"username": "bob", "created_at": None})

    def test_update_omits_none_fields(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert request.url.params["username"] == "eq.bob"
            body = request.read().decode()
            assert '"password_hash":"h"' in body
            assert "created_at" not in body
            return httpx.Response(204)

        client = make_client(handler)
        client.update("users", {"username": "bob"}, {"password_hash": "h", "created_at": None})

    def test_delete_returns_deleted_count(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "DELETE"
            assert request.headers["Prefer"] == "return=representation"
            return _ok([{"id": "x"}, {"id": "y"}])

        client = make_client(handler)
        assert client.delete("device_registry", {"user_id": "u"}) == 2


# ══════════════════════════════════════════════════════════════════
# PgHttpUserRepo
# ══════════════════════════════════════════════════════════════════

class TestPgHttpUserRepo:
    def test_get_maps_domain(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["username"] == "eq.alice"
            assert request.url.params["limit"] == "1"
            return _ok([{"username": "alice", "password_hash": "h", "status": "active",
                         "security_question": "q", "security_answer_hash": "a",
                         "created_at": "2026-08-15T09:00:00"}])

        repo = PgHttpUserRepo(make_client(handler))
        user = repo.get("alice")
        assert user is not None
        assert user.username == "alice"
        assert user.status == "active"
        assert user.created_at == datetime.fromisoformat("2026-08-15T09:00:00")

    def test_get_missing_returns_none(self):
        repo = PgHttpUserRepo(make_client(lambda req: _ok([])))
        assert repo.get("nobody") is None

    def test_create_sends_required_fields(self):
        def handler(request: httpx.Request) -> httpx.Response:
            body = request.read().decode()
            assert '"username":"c"' in body
            assert "created_at" not in body
            return httpx.Response(201)

        repo = PgHttpUserRepo(make_client(handler))
        repo.create(User(username="c", password_hash="h", status="active",
                         security_question="", security_answer_hash=""))

    def test_update_password_and_security(self):
        seen: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request.url.params["username"])
            return httpx.Response(204)

        repo = PgHttpUserRepo(make_client(handler))
        repo.update_password("alice", "newhash")
        repo.update_security("alice", "q2", "a2")
        assert seen == ["eq.alice", "eq.alice"]

    def test_flush_is_noop(self):
        repo = PgHttpUserRepo(make_client(lambda req: pytest.fail("不应有请求")))
        repo.flush()


# ══════════════════════════════════════════════════════════════════
# PgHttpCodeRepo
# ══════════════════════════════════════════════════════════════════

class TestPgHttpCodeRepo:
    def test_find_active_by_username_builds_filter_and_sort(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["bound_username"] == "eq.alice"
            assert request.url.params["status"] == "eq.active"
            assert request.url.params["order"] == "activated_at.desc"
            return _ok([{
                "code_id": "AC-1", "tier": "monthly", "duration_days": 30,
                "status": "active", "bound_username": "alice",
                "expires_at": "2026-09-15T00:00:00",
                "activated_at": "2026-08-15T00:00:00",
                "created_at": "2026-08-14T00:00:00", "created_by": "admin",
            }])

        repo = PgHttpCodeRepo(make_client(handler))
        codes = repo.find_active_by_username("alice")
        assert len(codes) == 1
        assert codes[0].code_id == "AC-1"
        assert codes[0].expires_at == datetime.fromisoformat("2026-09-15T00:00:00")

    def test_find_all_uses_limit_and_sort(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["order"] == "created_at.desc"
            assert request.url.params["limit"] == "200"
            return _ok([])

        repo = PgHttpCodeRepo(make_client(handler))
        assert repo.find_all() == []

    def test_activate_patches_expiry(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert request.url.params["code_id"] == "eq.AC-1"
            body = request.read().decode()
            assert '"status":"active"' in body
            assert '"bound_username":"alice"' in body
            assert '"expires_at":"2026-08-22T00:00:00"' in body
            return httpx.Response(204)

        repo = PgHttpCodeRepo(make_client(handler))
        repo.activate("AC-1", "alice", date(2026, 8, 22))

    def test_create_omits_none_timestamps_and_empty_binding(self):
        def handler(request: httpx.Request) -> httpx.Response:
            body = request.read().decode()
            assert '"code_id":"AC-2"' in body
            assert "created_at" not in body  # 时间戳走 DB DEFAULT
            # 空串 bound_username → 显式 null（NULL 不触发 FK 冲突）
            assert '"bound_username":null' in body
            return httpx.Response(201)

        repo = PgHttpCodeRepo(make_client(handler))
        repo.create(ActivationCode(
            code_id="AC-2", tier="trial", duration_days=7, status="unused",
            bound_username="", expires_at=None, activated_at=None,
            created_at=None, created_by="admin",
        ))


# ══════════════════════════════════════════════════════════════════
# PgHttpDeviceRepo / PgHttpGrantRepo / PgHttpConfigRepo
# ══════════════════════════════════════════════════════════════════

class TestPgHttpDeviceRepo:
    def test_upsert_inserts_new_device(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "GET":
                return _ok([])  # 不存在 → 走 insert
            assert request.method == "POST"
            body = request.read().decode()
            assert '"id":' in body and '"user_id":"alice"' in body
            assert "created_at" not in body
            return httpx.Response(201)

        repo = PgHttpDeviceRepo(make_client(handler))
        device = repo.upsert(DeviceRegistry(
            id="", user_id="alice", fingerprint="fp", hostname="PC",
            os="win", os_arch="x64"))
        assert len(device.id) == 32  # uuid4().hex
        assert device.hostname == "PC"

    def test_upsert_updates_existing_device(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "GET":
                return _ok([{"id": "d1", "user_id": "alice", "fingerprint": "fp",
                    "hostname": "旧", "os": "", "os_arch": "",
                    "last_active_at": "2026-08-01T00:00:00"}])
            assert request.method == "PATCH"
            body = request.read().decode()
            assert '"hostname":"新"' in body and '"last_active_at":"' in body
            return httpx.Response(204)

        repo = PgHttpDeviceRepo(make_client(handler))
        device = repo.upsert(DeviceRegistry(
            id="", user_id="alice", fingerprint="fp", hostname="新",
            os="", os_arch=""))
        assert device.hostname == "新"
        assert device.id == "d1"

    def test_delete_by_id_returns_bool(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["id"] == "eq.d9"
            return _ok([{"id": "d9"}])

        repo = PgHttpDeviceRepo(make_client(handler))
        assert repo.delete_by_id("d9", "alice") is True


class TestPgHttpGrantRepo:
    def test_get_maps_enrolled_bool(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return _ok([{"pc_hash": "h1", "username": "alice", "token": "t",
                         "enrolled": 1, "fingerprint": "fp"}])

        repo = PgHttpGrantRepo(make_client(handler))
        grant = repo.get("h1")
        assert grant is not None
        assert grant.enrolled is True
        assert grant.token == "t"

    def test_upsert_inserts_with_enrolled_int(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "GET":
                return _ok([])
            body = request.read().decode()
            assert '"enrolled":1' in body
            return httpx.Response(201)

        repo = PgHttpGrantRepo(make_client(handler))
        repo.upsert("h1", "alice", "t", True, "fp")

    def test_set_enrolled(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["pc_hash"] == "eq.h1"
            assert request.url.params["username"] == "eq.alice"
            body = request.read().decode()
            assert '"enrolled":0' in body
            return httpx.Response(204)

        repo = PgHttpGrantRepo(make_client(handler))
        repo.set_enrolled("h1", "alice", False)


class TestPgHttpConfigRepo:
    def test_get_returns_value_or_default(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.params["key"] == "eq.heartbeat_grace_days":
                return _ok([{"key": "heartbeat_grace_days", "value": "90"}])
            return _ok([])

        repo = PgHttpConfigRepo(make_client(handler))
        assert repo.get("heartbeat_grace_days") == "90"
        assert repo.get("missing", "fallback") == "fallback"
