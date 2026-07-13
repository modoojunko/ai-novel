# backend/auth_local/router.py
"""License 验证 API — C 端本地调用"""

from fastapi import APIRouter
from pydantic import BaseModel

from .service import (
    activate, login, verify_license, renew,
    list_devices, remove_device, reset_password,
    load_or_create_config, save_local_config, get_local_config
)

router = APIRouter(tags=["auth"])


class ActivateRequest(BaseModel):
    activation_code: str
    username: str
    password: str
    security_question: str
    security_answer: str


class LoginRequest(BaseModel):
    username: str
    password: str


class RenewRequest(BaseModel):
    activation_code: str


class ResetPasswordRequest(BaseModel):
    security_answer: str
    new_password: str


class DeviceRemoveRequest(BaseModel):
    pc_hash: str


class ApiKeySaveRequest(BaseModel):
    api_key: str
    api_base_url: str
    api_model: str


@router.post("/activate")
async def api_activate(req: ActivateRequest):
    """激活码 + 注册"""
    result = await activate(
        req.activation_code.strip().upper(),
        req.username.strip(),
        req.password,
        req.security_question.strip(),
        req.security_answer.strip(),
    )
    return result


@router.post("/login")
async def api_login(req: LoginRequest):
    """登录"""
    return await login(req.username.strip(), req.password)


@router.post("/verify")
async def api_verify():
    """验证 License"""
    return await verify_license()


@router.post("/renew")
async def api_renew(req: RenewRequest):
    """续期"""
    return await renew(req.activation_code.strip().upper())


@router.get("/devices")
async def api_devices():
    """设备列表"""
    return await list_devices()


@router.post("/devices/remove")
async def api_devices_remove(req: DeviceRemoveRequest):
    """解绑设备"""
    return await remove_device(req.pc_hash)


@router.post("/reset-password")
async def api_reset_password(req: ResetPasswordRequest):
    """密保重置密码"""
    return await reset_password(req.security_answer, req.new_password)


@router.get("/config")
async def api_get_config():
    """获取本地配置（不含敏感字段）"""
    cfg = get_local_config()
    return {
        "username": cfg.get("username", ""),
        "pc_name": cfg.get("pc_name", ""),
        "pc_hash": cfg.get("pc_hash", ""),
        "tier": cfg.get("tier", ""),
        "expires_at": cfg.get("expires_at", ""),
        "last_verify_at": cfg.get("last_verify_at", ""),
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
    save_local_config(cfg)
    return {"code": 0, "msg": "保存成功"}
