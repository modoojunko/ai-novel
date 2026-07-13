# serverless/lib/code_utils.py
"""激活码生成工具"""

import secrets
import string
from datetime import timedelta, date
from typing import Optional


def generate_activation_code() -> str:
    """生成激活码，格式: AC-XXXX-YYYY-ZZZZ-WWWW"""
    def _block(length=4):
        chars = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))

    parts = [_block() for _ in range(4)]
    return f"AC-{'-'.join(parts)}"


def calc_expires_at(tier: str, from_date: Optional[date] = None) -> date:
    """根据套餐类型计算到期日"""
    duration_map = {
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "lifetime": 36500,  # 100年
    }
    days = duration_map.get(tier, 30)
    base = from_date or date.today()
    return base + timedelta(days=days)


def merge_expiry(current: Optional[date], new_days: int) -> date:
    """叠加续期：新到期日 = max(当前到期日, 今天) + duration_days"""
    today = date.today()
    base = max(current, today) if current else today
    return base + timedelta(days=new_days)
