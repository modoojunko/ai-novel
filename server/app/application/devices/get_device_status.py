"""C端 设备状态查询（裸字段格式，冻结不改变）。"""
from __future__ import annotations

from app.domain.devices import ActivationPolicy
from app.domain.licensing import License, tier_policy
from app.infrastructure.repositories.base import CodeRepo, DeviceRepo, GrantRepo


def get_device_status(
    grant_repo: GrantRepo,
    device_repo: DeviceRepo,
    code_repo: CodeRepo,
    username: str,
    pc_hash: str,
) -> dict:
    """返回设备状态（裸字段格式）。"""
    grant = grant_repo.get(pc_hash)
    enrolled = grant.enrolled if grant else False
    fp = grant.fingerprint if grant else ""

    codes = code_repo.find_active_by_username(username)
    license_ = License(username=username).merge(codes)
    tier = license_.effective_tier
    active_limit = tier_policy.get_device_limit(tier)

    devices = device_repo.list_by_user(username)
    target_fp = fp or (devices[0].fingerprint if devices else "")

    device_name = "未知设备"
    for d in devices:
        if d.fingerprint == target_fp:
            device_name = d.display_name
            break

    activation = ActivationPolicy.compute(devices, active_limit, target_fp, tier)

    return {
        "enrolled": enrolled,
        "device_name": device_name,
        "activated": activation["activated"],
        "reason": activation["reason"],
        "device_count": activation["total_count"],
        "active_limit": activation["active_limit"],
    }
