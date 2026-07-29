"""Pydantic 请求/响应模型。"""
from __future__ import annotations
from pydantic import BaseModel


# ── 请求模型 ──

class AuthorizeRequest(BaseModel):
    username: str
    password: str
    pc_hash: str
    pc_name: str = ""
    device_profile: str = ""

class VerifyRequest(BaseModel):
    username: str
    token: str
    pc_hash: str

class ResetPasswordRequest(BaseModel):
    username: str
    security_answer: str
    new_password: str

class WebLoginRequest(BaseModel):
    username: str
    password: str

class WebRegisterRequest(BaseModel):
    username: str
    password: str
    security_question: str = ""
    security_answer: str = ""

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class SecurityRequest(BaseModel):
    security_question: str
    security_answer: str

class ActivateLicenseRequest(BaseModel):
    code: str

class GenerateCodeRequest(BaseModel):
    admin_token: str
    tier: str = "monthly"
    count: int = 1

class QueryCodesRequest(BaseModel):
    admin_token: str
    username: str = ""

class DeviceRemoveRequest(BaseModel):
    id: str = ""
    pc_hash: str = ""


# ── 通用响应包装 ──

def ok(data: dict = None) -> dict:
    return {"code": 0, "msg": "ok", "data": data or {}}

def fail(code: int = 1, msg: str = "") -> dict:
    return {"code": code, "msg": msg or "请求失败"}
