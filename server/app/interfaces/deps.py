"""FastAPI 依赖注入。"""
from __future__ import annotations
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.config import settings
from app.infrastructure.repositories.pg_http import get_pg_client
from app.infrastructure.repositories.pg_http.client import PgRestClient
from app.models.base import get_db as _get_sql_db
from app.infrastructure.security.jwt import verify_jwt

# DB handle 联合类型：sqlite 后端为 Session，pg_http 后端为 PgRestClient
Db = Session | PgRestClient


def get_db():
    """FastAPI Depends 用：按 DB_BACKEND 产出请求级 DB handle。"""
    if settings.DB_BACKEND == "pg_http":
        yield get_pg_client()
    else:
        yield from _get_sql_db()


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
