"""检查 License 和设备绑定状态（C端 心跳验证）。"""
from __future__ import annotations
from app.infrastructure.repositories.base import UserRepo, CodeRepo, DeviceRepo
from app.domain.licensing import License, tier_policy


def verify_license(
    user_repo: UserRepo,
    code_repo: CodeRepo,
    device_repo: DeviceRepo,
    grant_repo: GrantRepo,
    username: str,
    pc_hash: str,
    token: str,
) -> dict:
    """验证 License + 设备绑定状态（C端 心跳用）。"""
    from app.infrastructure.security.jwt import verify_jwt

    # 1) 验证 token（JWT 校验 + username 比对）
    payload = verify_jwt(token)
    if not payload:
        return {"code": 2, "msg": "Token 无效"}
    token_username = payload.get("sub", "")
    if token_username != username:
        return {"code": 2, "msg": "Token 与用户名不匹配"}

    # 2) 用户存在性
    user = user_repo.get(username)
    if not user:
        return {"code": 1, "msg": "用户不存在"}

    # 3) License 有效性（实时聚合 codes 表）
    codes = code_repo.find_active_by_username(username)
    license_ = License(username=username).merge(codes)
    license_valid = license_.is_valid()

    # 4) 设备绑定校验
    from app.infrastructure.repositories.base import GrantRepo
    grant = grant_repo.get(pc_hash)
    device_valid = grant is not None and grant.username == username
    valid = license_valid and device_valid

    # 5) 设备总数
    devices = device_repo.list_by_user(username)

    return {
        "code": 0,
        "data": {
            "valid": valid,
            "license_valid": license_valid,
            "device_valid": device_valid,
            "expires_at": license_.max_expires_at.isoformat() if license_.max_expires_at else "",
            "tier": license_.effective_tier,
            "devices_count": len(devices),
            "max_devices": tier_policy.get_device_limit(license_.effective_tier),
        },
    }
