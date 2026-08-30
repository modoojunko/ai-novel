"""account-deletion：C端 代理层会话失效处理（tasks 5.1）。

S端 check-auth 明确「未登录/已注销」且本地曾有凭据 → 清空 config.json 登录字段
（作品数据为本地 SQLite，本用例同时断言清空动作不触碰其他配置项）。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from auth_local import service


@pytest.fixture
def logged_in_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """临时 DATA_ROOT + 已登录 config.json。"""
    data_root = tmp_path / "data"
    data_root.mkdir()
    cfg = {
        "pc_hash": "pchos",
        "pc_name": "TestPC",
        "api_key": "sk-test",
        "token": "jwt-old",
        "username": "writer1",
        "tier": "yearly",
        "expires_at": "2027-01-01",
        "last_login_at": "2026-08-01T00:00:00+00:00",
        "server_api": "",
        "portal_url": "",
    }
    (data_root / "config.json").write_text(json.dumps(cfg), encoding="utf-8")
    monkeypatch.setattr(service, "CONFIG_DIR", str(data_root))
    monkeypatch.setattr(service, "CONFIG_FILE", str(data_root / "config.json"))
    return data_root / "config.json"


def _sync(payload: dict):
    """call_server_api 为 async——monkeypatch 换成闭包 async 函数返回同一载荷。"""
    async def _call(*a, **k):
        return payload
    return _call


@pytest.mark.anyio
async def test_session_invalid_clears_credentials(
    logged_in_config: Path, monkeypatch: pytest.MonkeyPatch
):
    """S端 回已注销/未登录 → 清 token/username/tier，保留作品与设备配置。"""
    monkeypatch.setattr(
        service,
        "call_server_api",
        _sync({"code": 1, "data": {"deleted": True}}),
    )
    result = await service.browser_auth(silent=True)
    assert result["data"]["session_invalid"] is True
    assert result["data"]["deleted"] is True
    assert "作品仍完好保留" in result["data"]["message"]

    cfg = json.loads(logged_in_config.read_text(encoding="utf-8"))
    assert cfg["token"] == ""
    assert cfg["tier"] == "none"
    assert not cfg.get("deletion_pending"), "会话失效应同时清除撤销期暂停标记"
    # 非登录字段不动：设备指纹与 AI 配置保留
    assert cfg["pc_hash"] == "pchos"
    assert cfg["api_key"] == "sk-test"


@pytest.mark.anyio
async def test_fresh_install_keeps_untouched(
    logged_in_config: Path, monkeypatch: pytest.MonkeyPatch
):
    """本地无 token（从未登录）→ code 1 普通未登录，不产生失效信号。"""
    cfg = json.loads(logged_in_config.read_text(encoding="utf-8"))
    cfg["token"] = ""
    logged_in_config.write_text(json.dumps(cfg), encoding="utf-8")
    monkeypatch.setattr(
        service, "call_server_api", _sync({"code": 1, "data": {}})
    )
    result = await service.browser_auth(silent=True)
    assert result["data"].get("session_invalid") is not True
    assert result["data"]["message"] == "未登录"


@pytest.mark.anyio
async def test_deletion_pending_keeps_credentials(
    logged_in_config: Path, monkeypatch: pytest.MonkeyPatch
):
    """撤销期（code 2）：凭据保留（可撤销恢复），权限标记落盘，返回结构化暂停提示。"""
    monkeypatch.setattr(
        service,
        "call_server_api",
        _sync({
            "code": 2,
            "data": {"deletion_pending": True, "days_left": 12, "deadline": "2026-09-13"},
        }),
    )
    result = await service.browser_auth(silent=True)
    assert result["code"] == 2
    assert result["data"]["deletion_pending"] is True
    cfg = json.loads(logged_in_config.read_text(encoding="utf-8"))
    assert cfg["token"] == "jwt-old", "撤销期不清凭据"
    assert cfg["deletion_pending"] is True, "权限暂停标记必须落盘（AI 门禁读取）"


def test_check_permission_blocked_during_pending(logged_in_config: Path):
    """撤销期标记 → check_permission allowed=False（AI 门禁据此冻结付费能力）。"""
    cfg = json.loads(logged_in_config.read_text(encoding="utf-8"))
    cfg["tier"] = "yearly"
    cfg["deletion_pending"] = True
    logged_in_config.write_text(json.dumps(cfg), encoding="utf-8")

    perm = service.check_permission()
    assert perm["allowed"] is False
    assert perm["is_member"] is False
    assert perm["reason"] == "deletion_pending"


def test_check_permission_restored_after_relogin(logged_in_config: Path):
    """重新登录清除标记 → 权限恢复（撤销后回归正常）。"""
    cfg = json.loads(logged_in_config.read_text(encoding="utf-8"))
    cfg["tier"] = "yearly"
    cfg["expires_at"] = "2027-01-01"
    cfg["last_login_at"] = "2026-08-30T00:00:00+00:00"
    cfg["deletion_pending"] = False
    logged_in_config.write_text(json.dumps(cfg), encoding="utf-8")

    perm = service.check_permission()
    assert perm["allowed"] is True
    assert perm["is_member"] is True
