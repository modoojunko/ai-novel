from __future__ import annotations

from datetime import UTC, datetime, timedelta

from jose import JWTError
from jose import jwt as jose_jwt

from app.config import settings


def sign_jwt(username: str) -> str:
    """签发 JWT（30 天过期）。"""
    payload = {
        "sub": username,
        "username": username,
        "exp": int((datetime.now(UTC) + timedelta(days=settings.JWT_EXPIRE_DAYS)).timestamp()),
    }
    return jose_jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_jwt(token: str) -> dict | None:
    """验证 JWT，返回 payload（含 username/sub）。无效返回 None。"""
    try:
        return jose_jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
