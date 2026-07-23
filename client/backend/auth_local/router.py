# backend/auth_local/router.py
"""浏览器 OAuth 登录 API"""

from fastapi import APIRouter
from pydantic import BaseModel

from .service import (
    browser_auth,
    verify_session,
    check_permission,
    reset_password,
    load_or_create_config,
    get_local_config,
)

router = APIRouter(tags=["auth"])


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
async def api_get_config():
    """获取本地配置"""
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
async def api_save_api_key(req: ApiKeySaveRequest):
    """保存 AI API Key"""
    cfg = load_or_create_config()
    cfg["api_key"] = req.api_key
    cfg["api_base_url"] = req.api_base_url
    cfg["api_model"] = req.api_model
    from .service import save_local_config

    save_local_config(cfg)
    return {"code": 0, "msg": "保存成功"}
