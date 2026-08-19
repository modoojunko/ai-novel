"""用户名密码登录（门户使用，非 OAuth 流程）。"""
from __future__ import annotations

from app.domain.licensing import License
from app.infrastructure.repositories.base import CodeRepo, UserRepo
from app.infrastructure.security.jwt import sign_jwt
from app.infrastructure.security.password import verify_password


def login(user_repo: UserRepo, code_repo: CodeRepo, username: str, password: str) -> dict:
    """登录验证用户名密码，返回 JWT + 套餐信息。"""
    user = user_repo.get(username)
    if not user or not verify_password(password, user.password_hash):
        return {"code": 1, "msg": "用户名或密码错误"}
    if user.is_locked():
        return {"code": 1, "msg": "账户已被锁定，请联系客服"}

    codes = code_repo.find_active_by_username(username)
    license_ = License(username=username).merge(codes)
    token = sign_jwt(username)

    return {
        "code": 0,
        "data": {
            "token": token,
            "tier": license_.effective_tier,
            "expires_at": license_.max_expires_at.isoformat() if license_.max_expires_at else "",
        },
    }
