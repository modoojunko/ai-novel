"""auth_local middleware 会话校验口径（2026-08-22 死循环 bug 回归）

口径：middleware 只管「会话有效性」——token 与 config.json 一致 + last_login 30 天新鲜。
expires_at 是套餐/试用到期日（产品口径：过期降免费待遇限 1 项目，由 S端 verify
与前端横幅呈现），不是会话有效性——不得据此 401。否则过期用户会陷入
「check-auth 成功 ↔ 业务 401 踢回登录页」无限「登录成功」循环。

用法：
    cd client/backend
    .venv/bin/python -m pytest tests/test_auth_middleware_session.py -v
"""

import os
import tempfile
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

_tmp_db = tempfile.NamedTemporaryFile(suffix="_auth_mw.db", delete=False)  # noqa: SIM115
_tmp_db.close()
_tmp_data_root = tempfile.mkdtemp(prefix="test_auth_mw_")

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp_db.name}"
os.environ["DATA_ROOT"] = _tmp_data_root

import auth_local.middleware as _middleware
import auth_local.service as _service

# 全量跑时 middleware/service 的 CONFIG_FILE 已被更早的测试文件绑到别处，
# 显式指回本文件的临时配置
from auth_local.middleware import get_current_user

_CFG_PATH = os.path.join(_tmp_data_root, "config.json")
_TOKEN = "unit-session-token"


def _write_cfg(**extra):
    _service.CONFIG_FILE = _CFG_PATH
    _middleware.CONFIG_FILE = _CFG_PATH
    cfg = {
        "token": _TOKEN,
        "username": "expired_user",
        "last_login_at": datetime.now(UTC).isoformat(),  # 会话新鲜
        "expires_at": (datetime.now(UTC) - timedelta(days=5)).date().isoformat(),  # 套餐已过期
    }
    cfg.update(extra)
    _service.save_local_config(cfg)


def _creds(token: str = _TOKEN) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.mark.asyncio
async def test_expired_subscription_still_valid_session():
    """套餐过期 ≠ 会话失效：过期用户应能进应用（免费待遇），不得 401。"""
    _write_cfg()
    user = await get_current_user(_creds())
    assert user == {"id": "expired_user"}


@pytest.mark.asyncio
async def test_token_mismatch_401():
    _write_cfg()
    with pytest.raises(HTTPException) as e:
        await get_current_user(_creds("another-token"))
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_stale_last_login_401():
    """真正的会话过期（30 天未续）仍然 401。"""
    _write_cfg(
        last_login_at=(datetime.now(UTC) - timedelta(days=31)).isoformat(),
    )
    with pytest.raises(HTTPException) as e:
        await get_current_user(_creds())
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_token_401():
    _write_cfg(token="")
    with pytest.raises(HTTPException) as e:
        await get_current_user(_creds())
    assert e.value.status_code == 401
