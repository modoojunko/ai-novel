"""CloudBase PG HTTP API 用户仓储。"""
from __future__ import annotations
from app.infrastructure.repositories.pg_http.client import PgRestClient, parse_dt
from app.domain.identity import User

_TABLE = "users"


class PgHttpUserRepo:
    def __init__(self, client: PgRestClient):
        self.client = client

    @staticmethod
    def _to_domain(doc: dict) -> User:
        return User(
            username=doc["username"],
            password_hash=doc["password_hash"],
            status=doc.get("status", "active"),
            security_question=doc.get("security_question", "") or "",
            security_answer_hash=doc.get("security_answer_hash", "") or "",
            created_at=parse_dt(doc.get("created_at")),
        )

    def get(self, username: str) -> User | None:
        doc = self.client.find_one(_TABLE, {"username": username})
        return self._to_domain(doc) if doc else None

    def exists(self, username: str) -> bool:
        return self.client.find_one(_TABLE, {"username": username}) is not None

    def create(self, user: User) -> User:
        # 省略 created_at：数据库 DEFAULT now()
        self.client.insert(_TABLE, {
            "username": user.username,
            "password_hash": user.password_hash,
            "security_question": user.security_question,
            "security_answer_hash": user.security_answer_hash,
            "status": user.status,
        })
        return user

    def update_password(self, username: str, new_password_hash: str) -> None:
        self.client.update(_TABLE, {"username": username}, {"password_hash": new_password_hash})

    def update_security(self, username: str, question: str, answer_hash: str) -> None:
        self.client.update(
            _TABLE,
            {"username": username},
            {"security_question": question, "security_answer_hash": answer_hash},
        )

    def flush(self) -> None:
        """无 FK 顺序问题，no-op。"""
        return
