from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime


@dataclass
class License:
    """License 聚合：合并用户所有激活码的到期日与套餐。"""
    username: str
    max_expires_at: datetime | None = None
    effective_tier: str = "none"

    def is_valid(self) -> bool:
        """License 是否在有效期内（按日期比较，忽略时间）。"""
        if self.max_expires_at is None:
            return False
        return self.max_expires_at.date() >= date.today()

    def merge(self, codes: list) -> License:
        """从 codes 列表计算到期日和 tier。"""
        max_exp = None
        tier = "none"
        for c in codes:
            if c.expires_at and (max_exp is None or c.expires_at > max_exp):
                max_exp = c.expires_at
                tier = c.tier
        self.max_expires_at = max_exp
        self.effective_tier = tier if max_exp else "none"
        return self
