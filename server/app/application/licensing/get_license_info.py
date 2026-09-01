"""查询用户当前 License 信息。"""
from __future__ import annotations

from app.application.identity.update_user_theme import stored_to_wire
from app.domain.licensing import License
from app.infrastructure.repositories.base import CodeRepo, UserRepo


def get_license_info(user_repo: UserRepo, code_repo: CodeRepo, username: str) -> dict:
    user = user_repo.get(username)
    if not user:
        return {"code": 1, "msg": "用户不存在"}
    codes = code_repo.find_active_by_username(username)
    license_ = License(username=username).merge(codes)
    return {
        "code": 0,
        "data": {
            "username": username,
            "tier": license_.effective_tier,
            "expires_at": license_.max_expires_at.isoformat() if license_.max_expires_at else "",
            "is_valid": license_.is_valid(),
            "theme": stored_to_wire(user.theme),
            # account-blocks-unify：密保只回问题文本，答案哈希任何接口不出门
            "security_question": user.security_question or "",
            "registered_at": user.created_at.strftime("%Y-%m-%d") if user.created_at else "",
        },
    }
