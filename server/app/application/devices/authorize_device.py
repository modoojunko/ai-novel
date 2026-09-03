"""OAuth 授权流核心用例。"""
from __future__ import annotations

from app.domain.devices import DeviceProfile, DeviceRegistry
from app.domain.licensing import License
from app.infrastructure.repositories.base import (
    CodeRepo,
    DeviceRepo,
    GrantRepo,
    UserRepo,
)
from app.infrastructure.security.jwt import sign_jwt
from app.infrastructure.security.password import verify_password


def authorize_device(
    user_repo: UserRepo,
    code_repo: CodeRepo,
    device_repo: DeviceRepo,
    grant_repo: GrantRepo,
    username: str,
    password: str,
    pc_hash: str,
    pc_name: str = "",
    device_profile_b64: str = "",
) -> dict:
    # 1) 验证用户
    user = user_repo.get(username)
    if not user or not verify_password(password, user.password_hash):
        return {"code": 1, "msg": "用户名或密码错误"}

    # 2) 设备注册
    profile = DeviceProfile.from_b64(device_profile_b64)
    fp = profile.fingerprint
    device = DeviceRegistry(
        id="",  # repo 自动生成
        user_id=username,
        fingerprint=fp,
        hostname=profile.hostname or pc_name,
        os=profile.os,
        os_arch=profile.os_arch,
    )
    existing = device_repo.get_by_fingerprint(username, fp) if fp else None
    is_new = existing is None
    device_repo.upsert(device)

    # 3) 查询套餐
    codes = code_repo.find_active_by_username(username)
    license_ = License(username=username).merge(codes)

    # 4) 写入授权凭证（token 携带 uid，jwt-uid-claim 与 web 签发同口径）
    token = sign_jwt(username, user_repo.get_id(username))
    grant_repo.upsert(
        pc_hash=pc_hash,
        username=username,
        token=token,
        enrolled=is_new,
        fingerprint=fp,
    )

    return {
        "code": 0,
        "data": {
            "message": "授权成功",
            "tier": license_.effective_tier,
            "expires_at": license_.max_expires_at.isoformat() if license_.max_expires_at else "",
        },
    }
