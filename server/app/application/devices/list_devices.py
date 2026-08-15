"""列出用户所有设备（含激活状态）。"""
from __future__ import annotations
from app.infrastructure.repositories.base import DeviceRepo, CodeRepo
from app.domain.devices import ActivationPolicy
from app.domain.licensing import License, tier_policy


def list_devices(device_repo: DeviceRepo, code_repo: CodeRepo, username: str) -> dict:
    devices = device_repo.list_by_user(username)
    codes = code_repo.find_active_by_username(username)
    license_ = License(username=username).merge(codes)
    tier = license_.effective_tier
    active_limit = tier_policy.get_device_limit(tier)

    result = ActivationPolicy.compute_all(devices, active_limit, tier)
    activated_count = sum(1 for d in result if d["activated"])

    return {
        "code": 0,
        "data": result,
        "total_count": len(result),
        "activated_count": activated_count,
        "active_limit": active_limit,
    }
