from __future__ import annotations
from datetime import date, timedelta
from app.config import settings


def get_device_limit(tier: str) -> int:
    """套餐 → 设备限额。未知套餐默认 1。"""
    policy = settings.TIER_POLICY.get(tier)
    return policy["device_limit"] if policy else 1


def get_duration_days(tier: str) -> int:
    """套餐 → 有效天数。"""
    policy = settings.TIER_POLICY.get(tier)
    return policy["duration_days"] if policy else 0


def get_display_name(tier: str) -> str:
    """套餐 → 中文显示名。"""
    policy = settings.TIER_POLICY.get(tier)
    return policy["display"] if policy else tier


def calc_expires_at(tier: str, base: date | None = None) -> date:
    """根据套餐类型，计算到期日（从 base 或今天起算）。返回 date 类型。"""
    days = get_duration_days(tier)
    start = base or date.today()
    return start + timedelta(days=days)
