from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ActivationCode:
    """激活码实体，包含状态机。"""
    code_id: str
    tier: str
    duration_days: int
    status: str              # "unused" | "active"
    bound_username: str
    expires_at: datetime | None
    activated_at: datetime | None
    created_at: datetime | None
    created_by: str

    def can_activate(self) -> bool:
        """状态机：只有 unused 的码可以被激活。"""
        return self.status == "unused"

    def activate(self, username: str, expire_date: datetime) -> None:
        """激活码 → active。由领域服务调用。"""
        self.status = "active"
        self.bound_username = username
        self.expires_at = expire_date
        self.activated_at = datetime.now()
