"""账号自助注销：状态常量与撤销期口径（design D1）。

撤销期时长与《用户服务协议》§三.5「15 天撤销期」逐字对应——改这里必须升协议版本。
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

DELETION_STATUS_NORMAL = "正常"
DELETION_STATUS_PENDING = "注销撤销期"
DELETION_STATUS_DELETED = "已注销"

DELETION_PERIOD_DAYS = 15


def utcnow_naive() -> datetime:
    """naive UTC。库内 datetime 统一按 naive UTC 比较（sqlite CURRENT_TIMESTAMP 与 PG now() 落库均归一）。"""
    return datetime.now(UTC).replace(tzinfo=None)


def deadline_from(requested_at: datetime) -> datetime:
    return requested_at.replace(microsecond=0) + timedelta(days=DELETION_PERIOD_DAYS)


def remaining_days(deadline: datetime, now: datetime | None = None) -> int:
    """剩余撤销天数（向上取整：不满 1 天算 1 天，与用户对"还剩 N 天"的直觉一致）。"""
    now = now or utcnow_naive()
    delta = deadline - now
    if delta.total_seconds() <= 0:
        return 0
    return delta.days + (1 if delta.seconds or delta.microseconds else 0)


def is_due(deadline: datetime, now: datetime | None = None) -> bool:
    now = now or utcnow_naive()
    return deadline <= now
