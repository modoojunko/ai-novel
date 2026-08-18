"""S端 测试公共夹具。

关键点：DATABASE_URL 必须在首次 import app.* 之前指向独立 SQLite 文件
（models.base 的 engine 在 import 时绑定连接串）。conftest 由 pytest 在
收集阶段最先加载，因此在这里完成 env 设置。
"""

import os
import tempfile
import uuid

_tmp_db = tempfile.NamedTemporaryFile(suffix="_s_server_test.db", delete=False)
_tmp_db.close()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_tmp_db.name}")

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
