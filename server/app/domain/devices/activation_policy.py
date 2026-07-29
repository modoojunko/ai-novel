from __future__ import annotations
from app.domain.devices.device import DeviceRegistry


class ActivationPolicy:
    """设备激活策略（领域服务）。"""

    @staticmethod
    def compute(
        devices: list[DeviceRegistry],
        active_limit: int,
        target_fingerprint: str | None = None,
        tier: str = "none",
    ) -> dict:
        """计算单个设备的激活状态。"""
        top_n_fps = {d.fingerprint for d in devices[:active_limit]} if active_limit > 0 else set()
        activated = target_fingerprint in top_n_fps if target_fingerprint and active_limit > 0 else False

        reason = None
        if not activated:
            if tier == "none":
                reason = {
                    "code": "account_inactive",
                    "message": "账号未激活，所有设备均为免费模式。请购买套餐后使用全功能",
                }
            else:
                reason = {
                    "code": "limit_exceeded",
                    "message": f"已超出设备限额（限额 {active_limit} 台），升级套餐可激活全功能",
                }

        activated_count = sum(1 for d in devices[:active_limit] if d.fingerprint) if active_limit > 0 else 0

        return {
            "activated": activated,
            "reason": reason,
            "total_count": len(devices),
            "activated_count": min(activated_count, active_limit) if active_limit > 0 else 0,
            "active_limit": active_limit,
        }

    @staticmethod
    def compute_all(
        devices: list[DeviceRegistry],
        active_limit: int,
        tier: str = "none",
    ) -> list[dict]:
        """批量计算所有设备的激活状态。"""
        top_n_fps = {d.fingerprint for d in devices[:active_limit]} if active_limit > 0 else set()
        results = []
        for i, d in enumerate(devices):
            is_activated = d.fingerprint in top_n_fps
            reason = None
            if not is_activated:
                if tier == "none":
                    reason = {"code": "account_inactive", "message": "账号未激活，所有设备均为免费模式"}
                else:
                    reason = {"code": "limit_exceeded", "message": f"已超出设备限额（限额 {active_limit} 台）"}
            results.append({
                "id": d.id,
                "hostname": d.display_name,
                "os": d.os,
                "os_arch": d.os_arch,
                "fingerprint": d.fingerprint,
                "activated": is_activated,
                "reason": reason,
                "is_current": i == 0,
                "last_active_at": d.last_active_at.isoformat() if d.last_active_at else "",
                "bound_at": d.bound_at.isoformat() if d.bound_at else "",
            })
        return results
