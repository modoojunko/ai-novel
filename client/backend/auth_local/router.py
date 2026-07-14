# backend/auth_local/router.py
"""登录 + 30 天会话验证 API"""

from fastapi import APIRouter
from pydantic import BaseModel

from .service import (
    login, register, verify_session, refresh_session,
    reset_password, load_or_create_config, get_local_config,
)

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    security_question: str = ""
    security_answer: str = ""


class ResetPasswordRequest(BaseModel):
    username: str
    security_answer: str
    new_password: str


class ApiKeySaveRequest(BaseModel):
    api_key: str
    api_base_url: str
    api_model: str


@router.post("/login")
async def api_login(req: LoginRequest):
    """登录"""
    return await login(req.username.strip(), req.password)


@router.post("/register")
async def api_register(req: RegisterRequest):
    """首次注册"""
    return await register(
        req.username.strip(), req.password,
        req.security_question.strip(), req.security_answer.strip(),
    )


@router.post("/verify")
async def api_verify():
    """启动时验证 30 天会话"""
    return await verify_session()


@router.post("/refresh")
async def api_refresh():
    """后台静默刷新会话"""
    return await refresh_session()


@router.post("/reset-password")
async def api_reset_password(req: ResetPasswordRequest):
    """密保重置密码"""
    return await reset_password(req.security_answer, req.new_password)


@router.get("/config")
async def api_get_config():
    """获取本地配置"""
    cfg = get_local_config()
    return {
        "username": cfg.get("username", ""),
        "has_api_key": bool(cfg.get("api_key")),
        "api_base_url": cfg.get("api_base_url", ""),
        "api_model": cfg.get("api_model", ""),
    }


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
