# backend/auth_local/router.py
"""浏览器 OAuth 登录 API"""

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api_configs.crypto import encrypt_api_key
from api_configs.vendor import resolve_vendor
from db import get_db
from models.api_config import ApiConfig
from models.user import User

from .middleware import get_current_user
from .service import (
    _get_server_api,
    browser_auth,
    check_permission,
    get_local_config,
    verify_session,
)

router = APIRouter(tags=["auth"])


class ApiKeySaveRequest(BaseModel):
    api_key: str
    api_base_url: str
    api_model: str


class ApiKeyVerifyRequest(BaseModel):
    api_key: str
    api_base_url: str



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



@router.get("/devices/current")
async def get_current_device(
    user: dict = Depends(get_current_user),
):
    """获取当前设备激活状态（代理到 S端）"""
    cfg = get_local_config()
    token = cfg.get("token", "")
    pc_hash = cfg.get("pc_hash", "")

    if not token:
        return {
            "enrolled": False,
            "activated": False,
            "device_count": 0,
            "active_limit": 0,
        }

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{_get_server_api()}/api/devices/current",
                params={"pc_hash": pc_hash},
                headers={"Authorization": f"Bearer {token}"},
            )
            result = resp.json()

        # 消费 enrolled
        if result.get("enrolled"):
            async with httpx.AsyncClient(timeout=3) as client:
                await client.post(
                    f"{_get_server_api()}/api/devices/consume-enrolled",
                    params={"pc_hash": pc_hash},
                    headers={"Authorization": f"Bearer {token}"},
                )

        return result
    except httpx.TimeoutException:
        return {
            "enrolled": False,
            "activated": False,
            "device_count": 0,
            "active_limit": 0,
            "error": "S端 超时",
        }
    except httpx.RequestError:
        return {
            "enrolled": False,
            "activated": False,
            "device_count": 0,
            "active_limit": 0,
            "error": "S端 不可达",
        }


@router.get("/config")
async def api_get_config(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取本地配置（从数据库，兼容旧 config.json）"""
    result = await db.execute(select(User).where(User.id == user["id"]))
    u = result.scalar_one_or_none()

    # 检查 ApiConfig 表中是否有任何配置（多 Key 时代）
    config_result = await db.execute(
        select(ApiConfig).where(ApiConfig.user_id == user["id"]).limit(1)
    )
    has_api_config = config_result.scalar_one_or_none() is not None

    if u:
        return {
            "has_token": bool(u.token),
            "tier": u.plan or "none",
            "expires_at": str(u.subscription_expires_at)
            if u.subscription_expires_at
            else "",
            "has_api_key": bool(u.api_key) or has_api_config,
            "api_base_url": u.api_base_url or "",
            "api_model": u.api_model or "",
        }
    # Fallback to config.json for migration period
    cfg = get_local_config()
    return {
        "has_token": bool(cfg.get("token", "")),
        "tier": cfg.get("tier", "none"),
        "expires_at": cfg.get("expires_at", ""),
        "has_api_key": has_api_config or bool(cfg.get("api_key")),
        "api_base_url": cfg.get("api_base_url", ""),
        "api_model": cfg.get("api_model", ""),
    }


@router.get("/user/profile")
async def api_user_profile(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user profile with migration status."""
    result = await db.execute(select(User).where(User.id == user["id"]))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")

    resp: dict[str, Any] = {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
    }

    # Check if user has old api_key fields without ApiConfig
    has_old_fields = bool(u.api_key)
    if has_old_fields:
        # Check if at least one ApiConfig exists
        cfg_result = await db.execute(
            select(ApiConfig).where(ApiConfig.user_id == u.id).limit(1)
        )
        has_api_config = cfg_result.scalar_one_or_none() is not None

        if has_api_config:
            # Post-migration
            cfg = cfg_result.scalar_one()
            resp["migration_completed"] = True
            resp["migration_config_name"] = cfg.name
        else:
            # Pre-migration (has old fields but not migrated yet)
            resp["migration_completed"] = False
            resp["migration_config_name"] = None

    return resp


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
    """保存 AI API Key 到数据库 (创建或更新 ApiConfig)"""
    # Detect vendor from base_url
    vendor_id, vendor_name, _ = resolve_vendor(req.api_base_url)
    config_name = f"{vendor_name} 默认配置"

    # Look for existing ApiConfig with matching name
    existing = await db.execute(
        select(ApiConfig).where(
            ApiConfig.user_id == user["id"],
            ApiConfig.name == config_name,
        )
    )
    cfg = existing.scalar_one_or_none()

    if cfg:
        # Update existing config
        cfg.api_key = encrypt_api_key(req.api_key) if req.api_key else ""
        cfg.base_url = req.api_base_url or ""
    else:
        # Create new config
        cfg = ApiConfig(
            user_id=user["id"],
            name=config_name,
            vendor=vendor_id,
            vendor_display_name=vendor_name,
            api_key=encrypt_api_key(req.api_key) if req.api_key else "",
            base_url=req.api_base_url or "",
            status="active",
        )
        db.add(cfg)

    await db.commit()
    return {"code": 0, "msg": "保存成功"}
