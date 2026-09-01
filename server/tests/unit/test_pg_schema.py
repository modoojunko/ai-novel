"""pg_schema 自检单测：MockTransport 模拟网关，验证探测编排与日志契约（design D3）。"""
from __future__ import annotations

import logging

import httpx

from app.infrastructure.pg_schema import REQUIRED, run_schema_check
from app.infrastructure.repositories.pg_http.client import PgRestClient

ENDPOINT = "https://env.api.tcloudbasegateway.com/v1/rdb/rest"
SENTINEL = "__pg_schema_probe__"


def make_client(handler) -> PgRestClient:
    return PgRestClient(ENDPOINT, "test-key", transport=httpx.MockTransport(handler))


def respond(status: int, code: str = "", body: list | None = None) -> httpx.Response:
    payload: dict | list = body if body is not None else []
    if code:
        payload = {"code": code, "message": "mock"}
    return httpx.Response(status, json=payload)


def all_ok(request: httpx.Request) -> httpx.Response:
    return respond(200)


# ── 全齐备 ──────────────────────────────────────────────────────

def test_all_present_logs_ok(caplog):
    caplog.set_level(logging.INFO, logger="app")
    run_schema_check(make_client(all_ok))
    message = caplog.records[-1].getMessage()
    assert "event=app.schema_check result=ok" in message
    assert f"tables={len(REQUIRED)}" in message


# ── 缺列：批量 400 → 逐列复探定位，其余表继续 ────────────────────

def test_missing_column_is_located_and_other_tables_continue(caplog):
    caplog.set_level(logging.WARNING, logger="app")

    def handler(request: httpx.Request) -> httpx.Response:
        table = request.url.path.rstrip("/").rsplit("/", 1)[-1]
        selects = request.url.params["select"].split(",")
        if table == "users":
            if len(selects) > 1:
                return respond(400, "DATABASE_PGRST204")
            # 逐列复探：theme 缺失（网关对未知列回 400 PGRST204），其余在
            return respond(400, "DATABASE_PGRST204") if "theme" in selects else respond(200)
        return respond(200)

    run_schema_check(make_client(handler))
    message = caplog.records[-1].getMessage()
    assert "result=fail" in message
    assert "missing=users.theme" in message
    # 其余表继续探测且无缺失：missing 里只有 users.theme 一项
    assert message.count("users.") == 1


# ── 缺表 ────────────────────────────────────────────────────────

def test_missing_table_logged(caplog):
    caplog.set_level(logging.WARNING, logger="app")

    def handler(request: httpx.Request) -> httpx.Response:
        table = request.url.path.rstrip("/").rsplit("/", 1)[-1]
        return respond(404, "DATABASE_PGRST205") if table == "device_registry" else respond(200)

    run_schema_check(make_client(handler))
    message = caplog.records[-1].getMessage()
    assert "result=fail" in message
    assert "missing=device_registry" in message


# ── 文本列类型漂移：select 200，哨兵探测 22P02 ───────────────────

def test_text_column_type_mismatch_detected(caplog):
    caplog.set_level(logging.WARNING, logger="app")

    def handler(request: httpx.Request) -> httpx.Response:
        params = request.url.params
        if params.get("user_id") == f"eq.{SENTINEL}":
            # device_registry.user_id 生产为 bigint：哨兵探测撞 22P02
            return respond(400, "DATABASE_22P02")
        return respond(200)

    run_schema_check(make_client(handler))
    message = caplog.records[-1].getMessage()
    assert "result=fail" in message
    assert "missing=device_registry.user_id" in message


# ── 探测网络异常：probe_failed 且不抛 ────────────────────────────

def test_network_error_does_not_raise(caplog):
    caplog.set_level(logging.WARNING, logger="app")

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    run_schema_check(make_client(handler))
    message = caplog.records[-1].getMessage()
    assert "result=fail" in message
    assert "probe_failed=" in message


# ── server_default 对拍（D8）：根 OpenAPI default 与清单不一致 → mismatch ──

def _openapi_handler(request: httpx.Request) -> httpx.Response:
    """根路径返回迷你 swagger：users.deletion_status 默认值被改成 NULL 形态。"""
    if request.url.path.rstrip("/").endswith("/v1/rdb/rest") or request.url.path == "/":
        defs = {"users": {"properties": {
            "deletion_status": {"type": "string", "format": "character varying"},
            "status": {"type": "string", "default": "active"},
        }}}
        return httpx.Response(200, json={"swagger": "2.0", "definitions": defs})
    return httpx.Response(200, json=[])


def test_default_drift_reported_as_mismatch(caplog):
    caplog.set_level(logging.WARNING, logger="app")
    run_schema_check(make_client(_openapi_handler))
    message = caplog.records[-1].getMessage()
    assert "result=fail" in message
    assert "mismatch=users.deletion_status#default(正常)" in message
    assert "users.status" not in message.split("mismatch=")[-1]  # 一致的列不记


def test_default_match_no_mismatch(caplog):
    caplog.set_level(logging.INFO, logger="app")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/":
            defs = {"users": {"properties": {
                "deletion_status": {"type": "string", "default": "正常"},
                "deletion_waive_assets": {"type": "boolean", "default": False},
                "status": {"type": "string", "default": "active"},
                "theme": {"type": "string", "default": ""},
                "security_question": {"type": "string", "default": ""},
                "security_answer_hash": {"type": "string", "default": ""},
            }}}
            return httpx.Response(200, json={"definitions": defs})
        return httpx.Response(200, json=[])

    run_schema_check(make_client(handler))
    message = caplog.records[-1].getMessage()
    assert "result=ok" in message


def test_openapi_unavailable_probe_failed(caplog):
    caplog.set_level(logging.WARNING, logger="app")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/":
            return httpx.Response(404, json={"code": "NOT_FOUND"})
        return httpx.Response(200, json=[])

    run_schema_check(make_client(handler))
    message = caplog.records[-1].getMessage()
    assert "probe_failed=openapi" in message
