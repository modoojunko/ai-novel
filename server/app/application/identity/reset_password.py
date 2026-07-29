"""密保重置密码。"""
from __future__ import annotations
from app.infrastructure.security.password import verify_password, hash_password
from app.infrastructure.repositories.user_repo import UserRepo


def reset_password(user_repo: UserRepo, username: str, security_answer: str, new_password: str) -> dict:
    user = user_repo.get(username)
    if not user:
        return {"code": 1, "msg": "用户不存在"}
    if not verify_password(security_answer, user.security_answer_hash):
        return {"code": 1, "msg": "密保答案错误"}

    user_repo.update_password(username, hash_password(new_password))
    return {"code": 0, "data": {"success": True}}
