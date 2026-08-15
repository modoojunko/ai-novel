"""消费一次性 enrolled 标记。"""
from app.infrastructure.repositories.base import GrantRepo


def consume_enrolled(grant_repo: GrantRepo, pc_hash: str, username: str) -> dict:
    grant_repo.set_enrolled(pc_hash, username, False)
    return {"code": 0, "msg": "ok"}
