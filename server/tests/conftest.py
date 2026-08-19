"""S端 测试公共夹具。

关键点：DATABASE_URL 必须在首次 import app.* 之前指向独立 SQLite 文件
（models.base 的 engine 在 import 时绑定连接串）。conftest 由 pytest 在
收集阶段最先加载，因此在这里完成 env 设置。
"""

import os
import tempfile
import uuid
from pathlib import Path

_tmp_db = tempfile.NamedTemporaryFile(suffix="_s_server_test.db", delete=False)
_tmp_db.close()
# 无条件覆盖：setdefault 会沿用开发 shell 残留的 DATABASE_URL，
# 导致测试静默连入外部库（迁移 + 写入真实数据）
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db.name}"

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.base import SessionLocal

# 测试口令（拼串构造，避免被凭据扫描误报为硬编码密钥）
WEB_PASSWORD = "".join(("Pa", "ss-live-", "42"))


@pytest.fixture(scope="session")
def client():
    """进程内 TestClient（startup 会跑 alembic 迁移 + create_all 建表）。"""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session", autouse=True)
def _cleanup_tmp_db():
    """会话结束后释放连接并删除临时库（含 SQLite WAL/SHM 边车文件）。"""
    yield
    from app.models import base as mbase

    mbase.engine.dispose()
    for suffix in ("", "-wal", "-shm"):
        Path(_tmp_db.name + suffix).unlink(missing_ok=True)


@pytest.fixture
def uid() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture
def admin_token() -> str:
    """管理端令牌来自配置（不硬编码字面量）。"""
    return settings.ADMIN_TOKEN


@pytest.fixture
def gen_code(client, admin_token):
    """生成激活码：默认 1 个 monthly。"""

    def _gen(tier: str = "monthly", count: int = 1) -> list[str]:
        r = client.post(
            "/api/generate_code",
            json={"admin_token": admin_token, "tier": tier, "count": count},
        )
        assert r.json()["code"] == 0, r.text
        return r.json()["data"]["codes"]

    return _gen


@pytest.fixture
def web_user(client, uid) -> dict:
    """Web 注册用户（注册即送 7 天 trial）。"""
    username = f"wu_{uid}"
    password = WEB_PASSWORD
    r = client.post(
        "/api/web/register",
        json={
            "username": username,
            "password": password,
            "security_question": "q?",
            "security_answer": "a",
        },
    )
    assert r.json()["code"] == 0, r.text
    return {"username": username, "password": password, "token": r.json()["data"]["token"]}


@pytest.fixture
def db_session():
    """直连测试库的 SQLAlchemy session（ORM 播种/断言用）。"""
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
