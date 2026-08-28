from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class User:
    """用户实体。不包含密码哈希方法，只做状态判断。"""
    username: str
    password_hash: str
    status: str                # "active" | "locked"
    security_question: str
    security_answer_hash: str
    created_at: datetime | None = None
    theme: str = ""            # 界面主题 key（空 = 默认 teal，见 identity/theme.py）

    def is_active(self) -> bool:
        return self.status == "active"

    def is_locked(self) -> bool:
        return self.status == "locked"
