"""FastAPI 依赖注入。"""
from __future__ import annotations
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.models.base import get_db as _get_db
from app.infrastructure.security.jwt import verify_jwt


def get_db() -> Session:
    yield from _get_db()


def get_current_user(authorization: str = Header(default="")):
    """解析 JWT，返回 username。401 如果无效。"""
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供认证信息")
    token = authorization.replace("Bearer ", "")
    payload = verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="无效的令牌")
    return payload.get("sub", "")


def get_current_user_or_none(authorization: str = Header(default="")):
    """解析 JWT，返回 username 或 None（不抛 401）。"""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "")
    payload = verify_jwt(token)
    return payload.get("sub", "") if payload else None
