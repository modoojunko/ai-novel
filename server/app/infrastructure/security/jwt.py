from __future__ import annotations

from datetime import UTC, datetime, timedelta

from jose import JWTError
from jose import jwt as jose_jwt

from app.config import settings


def sign_jwt(username: str, uid: int) -> str:
    """签发 JWT（30 天过期）。

    uid=用户整型代理键（jwt-uid-claim）：业务表外键全站是 user_id，token 携带后
    web 业务端点凭 uid 直查、免每请求 username→id 翻译。uid 为权威身份（PK 不可变，
    注销后同名重注册获得新 uid）。严格鉴权依赖要求合法 uid；C端心跳只读 sub 不受影响。
    """
    payload = {
        "sub": username,
        "username": username,
        "uid": uid,
        "exp": int((datetime.now(UTC) + timedelta(days=settings.JWT_EXPIRE_DAYS)).timestamp()),
    }
    return jose_jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_jwt(token: str) -> dict | None:
    """验证 JWT，返回 payload（含 username/sub）。无效返回 None。"""
    try:
        return jose_jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
