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
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _build_engine(db_path: str):
    """创建独立的 engine + 建表，替换 app.models.base 的全局 engine/session。"""
    from app.models import base as mbase
    from app.models.base import Base

    new_engine = create_engine(f"sqlite:///{db_path}", connect_args={"timeout": 10})
    Base.metadata.create_all(bind=new_engine)
    mbase.engine = new_engine
    mbase.SessionLocal = sessionmaker(bind=new_engine)
    return new_engine


@pytest.fixture(scope="module")
def client():
    """针对新系统的 TestClient（独立临时 DB）。

    注意：替换的是全局 engine/SessionLocal，teardown 必须还原，
    否则后续测试模块（tests/test_*.py）会连到已删除的临时库。"""
    from app.config import settings
    from app.models import base as mbase
    orig_engine, orig_session_local = mbase.engine, mbase.SessionLocal
    orig_db_path = settings.DB_PATH

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db_path = tmp.name
    tmp.close()

    # 必须 import app 前设置 DB_PATH
    settings.DB_PATH = db_path

    new_engine = _build_engine(db_path)

    # 导入 app.main（会使用 settings.DB_PATH 和替换后的 engine/session）
    from app.main import app
    test_client = TestClient(app)

    _seed_new_db(db_path)

    yield test_client

    # 还原全局状态，再关闭/清理本模块的独立 engine
    mbase.engine = orig_engine
    mbase.SessionLocal = orig_session_local
    settings.DB_PATH = orig_db_path
    new_engine.dispose()
    os.unlink(db_path)


def _seed_new_db(db_path: str):
    """通过新系统的 ORM 写入种子数据。"""
    from app.infrastructure.security.jwt import sign_jwt
    from app.infrastructure.security.password import hash_password
    from app.models.base import SessionLocal
    from app.models.code import ActivationCodeORM
    from app.models.config import GlobalConfigORM
    from app.models.device import DeviceRegistryORM
    from app.models.grant import DeviceGrantORM
    from app.models.user import UserORM

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
    db.flush()  # 确保用户持久化，后续 FK 引用 id
    _user_row = db.query(UserORM.id).filter(UserORM.username == "modoojunko").first()
    _uid = _user_row[0]

    # trial code
    db.add(ActivationCodeORM(
        code_id="TRIAL-TEST-001",
        tier="trial",
        duration_days=7,
        status="active",
        user_id=_uid,
        activated_at=datetime.now(),
        expires_at=datetime.combine(expires, datetime.min.time()),
        created_by="system",
    ))

    # device_registry
    db.add(DeviceRegistryORM(
        id="test-device-reg-001",
        user_id=_uid,
        fingerprint="test-fingerprint-001",
        hostname="测试机-PC",
        os="Windows-11",
        os_arch="AMD64",
    ))

    # device_grant（原 auth_tokens）
    jwt_token = sign_jwt("modoojunko", 1)
    db.add(DeviceGrantORM(
        pc_hash="test-pc-hash-001",
        user_id=_uid,
        token=jwt_token,
        enrolled=1,
        fingerprint="test-fingerprint-001",
    ))

    db.commit()
    db.close()
