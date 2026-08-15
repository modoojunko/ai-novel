"""移除设备。"""
from __future__ import annotations
from app.infrastructure.repositories.base import DeviceRepo


def remove_device(device_repo: DeviceRepo, username: str, device_id: str) -> dict:
    device_repo.delete_by_id(device_id, username)
    return {"code": 0, "data": {"success": True}}
