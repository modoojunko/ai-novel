"""激活码激活/续费。"""
from __future__ import annotations

from datetime import UTC, datetime

from app.domain.licensing import License, tier_policy
from app.infrastructure.repositories.base import CodeRepo


def activate_code(code_repo: CodeRepo, username: str, code_id: str) -> dict:
    code = code_repo.get(code_id)
    if not code:
        return {"code": 1, "msg": "无效的激活码"}
    if not code.can_activate():
        return {"code": 1, "msg": "激活码已被使用"}

    existing_codes = code_repo.find_active_by_username(username)
    license_ = License(username=username).merge(existing_codes)
    today = datetime.now(UTC).date()  # UTC 日期口径，不依赖容器 TZ
    base = license_.max_expires_at.date() if (license_.max_expires_at and license_.max_expires_at.date() > today) else today
    new_expires = tier_policy.calc_expires_at(code.tier, base)

    code_repo.activate(code_id, username, new_expires)

    return {"code": 0, "data": {"new_expires_at": new_expires.isoformat()}}
