# backend/auth_local/router.py
"""浏览器 OAuth 登录 API"""

import hashlib
import os
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import JWT_ALGORITHM, JWT_SECRET
from db import get_db
from models.user import User

from .middleware import get_current_user
from .service import (
    browser_auth,
    check_permission,
    get_local_config,
    reset_password,
    verify_session,
)

router = APIRouter(tags=["auth"])


def require_dev_mode():
    """DEV_MODE 门控 — 非开发模式返回 403"""
    if os.environ.get("DEV_MODE") != "1":
        raise HTTPException(403, "仅在开发模式下可用")


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str = ""


class ResetPasswordRequest(BaseModel):
    username: str
    security_answer: str
    new_password: str


class ApiKeySaveRequest(BaseModel):
    api_key: str
    api_base_url: str
    api_model: str


class ApiKeyVerifyRequest(BaseModel):
    api_key: str
    api_base_url: str


@router.post("/register")
async def api_register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """DEV_MODE only: 注册用户并返回 JWT"""
    require_dev_mode()

    # 检查邮箱是否已注册
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(409, "邮箱已注册")

    # 创建用户
    user = User(
        email=req.email,
        password_hash=hashlib.pbkdf2_hmac(
            "sha256", req.password.encode(), b"ai-novel-salt", 600000
        ).hex(),
        display_name=req.display_name or req.email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 生成 JWT
    payload = {
        "sub": user.id,
        "email": user.email,
        "exp": int(datetime.now(UTC).timestamp()) + 30 * 86400,
    }
    access_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return {
        "access_token": access_token,
        "token": access_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
        },
    }


@router.get("/check-auth")
async def api_check_auth():
    """检查当前浏览器在 S端 是否已登录（静默）"""
    return await browser_auth(silent=True)


@router.post("/browser-auth")
async def api_browser_auth():
    """打开浏览器 OAuth 登录"""
    return await browser_auth()


@router.post("/verify")
async def api_verify():
    """验证 30 天会话"""
    return await verify_session()


@router.get("/permission")
async def api_permission():
    """检查套餐权限"""
    return check_permission()


@router.post("/refresh")
async def api_refresh():
    """刷新会话（启动时静默调用）"""
    result = await verify_session()
    return result


@router.post("/reset-password")
async def api_reset_password(req: ResetPasswordRequest):
    """密保重置密码"""
    return await reset_password(req.security_answer, req.new_password)


@router.get("/config")
async def api_get_config(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取本地配置（从数据库，兼容旧 config.json）"""
    result = await db.execute(select(User).where(User.id == user["id"]))
    u = result.scalar_one_or_none()
    if u and u.api_key:
        return {
            "has_token": bool(u.token),
            "tier": u.plan or "none",
            "expires_at": str(u.subscription_expires_at) if u.subscription_expires_at else "",
            "has_api_key": bool(u.api_key),
            "api_base_url": u.api_base_url or "",
            "api_model": u.api_model or "",
        }
    # Fallback to config.json for migration period
    cfg = get_local_config()
    return {
        "has_token": bool(cfg.get("token", "")),
        "tier": cfg.get("tier", "none"),
        "expires_at": cfg.get("expires_at", ""),
        "has_api_key": bool(cfg.get("api_key")),
        "api_base_url": cfg.get("api_base_url", ""),
        "api_model": cfg.get("api_model", ""),
    }


@router.post("/verify-key")
async def api_verify_key(req: ApiKeyVerifyRequest):
    """验证 API Key 是否可用"""
    from .key_verifier import get_verifier

    verifier = get_verifier(req.api_base_url)
    result = await verifier.verify(req.api_key, req.api_base_url)
    return result


@router.post("/config/api-key")
async def api_save_api_key(
    req: ApiKeySaveRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """保存 AI API Key 到数据库"""
    result = await db.execute(select(User).where(User.id == user["id"]))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    u.api_key = req.api_key
    u.api_base_url = req.api_base_url
    u.api_model = req.api_model
    await db.commit()
    return {"code": 0, "msg": "保存成功"}
