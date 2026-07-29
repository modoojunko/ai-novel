"""新系统契约测试 fixture：提供独立临时 DB 的 TestClient。

用法：
    pytest tests/contract/ -v

种子数据与旧系统 _seed 等价：
    - 用户 modoojunko / alexander123（密保：三体）
    - trial 套餐（7 天到期）
    - 设备 + 授权凭证
"""

from __future__ import annotations

import os
import tempfile
from datetime import date, timedelta, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _build_engine(db_path: str):
    """创建独立的 engine + 建表，替换 app.models.base 的全局 engine/session。"""
    from app.models.base import Base
    from app.models import base as mbase

    new_engine = create_engine(f"sqlite:///{db_path}", connect_args={"timeout": 10})
    Base.metadata.create_all(bind=new_engine)
    mbase.engine = new_engine
    mbase.SessionLocal = sessionmaker(bind=new_engine)
    return new_engine


@pytest.fixture(scope="module")
def client():
    """针对新系统的 TestClient（独立临时 DB）。"""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db_path = tmp.name
    tmp.close()

    # 必须 import app 前设置 DB_PATH
    from app.config import settings
    settings.DB_PATH = db_path

    _build_engine(db_path)

    # 导入 app.main（会使用 settings.DB_PATH 和替换后的 engine/session）
    from app.main import app
    test_client = TestClient(app)

    _seed_new_db(db_path)

    yield test_client

    # 关闭所有连接以便删除临时文件
    from app.models import base as mbase
    if mbase.engine:
        mbase.engine.dispose()
    os.unlink(db_path)


def _seed_new_db(db_path: str):
    """通过新系统的 ORM 写入种子数据。"""
    from app.models.base import SessionLocal
    from app.models.user import UserORM
    from app.models.code import ActivationCodeORM
    from app.models.device import DeviceRegistryORM
    from app.models.grant import DeviceGrantORM
    from app.models.config import GlobalConfigORM
    from app.infrastructure.security.password import hash_password
    from app.infrastructure.security.jwt import sign_jwt

    db = SessionLocal()
    expires = date.today() + timedelta(days=7)

    # global_config
    for k, v in [("heartbeat_grace_days", "90"), ("max_devices", "3")]:
        db.add(GlobalConfigORM(key=k, value=v))

    # user
    db.add(UserORM(
        username="modoojunko",
        password_hash=hash_password("alexander123"),
        security_question="我的第一本书是？",
        security_answer_hash=hash_password("三体"),
        status="active",
    ))

    # trial code
    db.add(ActivationCodeORM(
        code_id="TRIAL-TEST-001",
        tier="trial",
        duration_days=7,
        status="active",
        bound_username="modoojunko",
        activated_at=datetime.now(),
        expires_at=datetime.combine(expires, datetime.min.time()),
        created_by="system",
    ))

    # device_registry
    db.add(DeviceRegistryORM(
        id="test-device-reg-001",
        user_id="modoojunko",
        fingerprint="test-fingerprint-001",
        hostname="测试机-PC",
        os="Windows-11",
        os_arch="AMD64",
    ))

    # device_grant（原 auth_tokens）
    jwt_token = sign_jwt("modoojunko")
    db.add(DeviceGrantORM(
        pc_hash="test-pc-hash-001",
        username="modoojunko",
        token=jwt_token,
        enrolled=1,
        fingerprint="test-fingerprint-001",
    ))

    db.commit()
    db.close()
