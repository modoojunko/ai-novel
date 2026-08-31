"""CloudBase PG HTTP API 激活码仓储。

2026-08-30 代理键迁移：FK 从 username(String) 改为 user_id(BigInteger)。
仓储层接受 username 字符串或 user_id(int)，内部经 users 表解析。
"""
from __future__ import annotations

from datetime import date, datetime

from app.domain.licensing import ActivationCode
from app.infrastructure.repositories.pg_http.client import (
    PgRestClient,
    parse_dt,
    to_iso,
)

_TABLE = "codes"
_USERS_TABLE = "users"


class PgHttpCodeRepo:
    def __init__(self, client: PgRestClient):
        self.client = client

    def _resolve_user_id(self, username_or_id) -> int | None:
        """接受 username(str) 或 user_id(int)，返回 user_id(int)。"""
        if isinstance(username_or_id, int):
            return username_or_id
        if not username_or_id:
            return None
        row = self.client.find_one(_USERS_TABLE, {"username": username_or_id})
        return row.get("id") if row else None

    @staticmethod
    def _to_domain(doc: dict) -> ActivationCode:
        return ActivationCode(
            code_id=doc["code_id"],
            tier=doc["tier"],
            duration_days=doc["duration_days"],
            status=doc["status"],
            user_id=doc.get("user_id"),
            expires_at=parse_dt(doc.get("expires_at")),
            activated_at=parse_dt(doc.get("activated_at")),
            created_at=parse_dt(doc.get("created_at")),
            created_by=doc.get("created_by", "") or "",
        )

    def get(self, code_id: str) -> ActivationCode | None:
        doc = self.client.find_one(_TABLE, {"code_id": code_id})
        return self._to_domain(doc) if doc else None

    def find_all_by_username(self, username: str) -> list[ActivationCode]:
        uid = self._resolve_user_id(username)
        if uid is None:
            return []
        docs = self.client.find(_TABLE, {"user_id": uid}, sort=[("activated_at", "desc")])
        return [self._to_domain(d) for d in docs]

    def find_active_by_username(self, username: str) -> list[ActivationCode]:
        uid = self._resolve_user_id(username)
        if uid is None:
            return []
        docs = self.client.find(
            _TABLE,
            {"user_id": uid, "status": "active"},
            sort=[("activated_at", "desc")],
        )
        return [self._to_domain(d) for d in docs]

    def find_all(self, limit: int = 200) -> list[ActivationCode]:
        docs = self.client.find(_TABLE, sort=[("created_at", "desc")], limit=limit)
        return [self._to_domain(d) for d in docs]

    def create(self, code: ActivationCode) -> None:
        uid = self._resolve_user_id(code.user_id)
        self.client.insert(_TABLE, {
            "code_id": code.code_id,
            "tier": code.tier,
            "duration_days": code.duration_days,
            "status": code.status,
            "user_id": uid,
            "created_by": code.created_by,
        })

    def activate(self, code_id: str, username_or_id, expires_at: date) -> None:
        uid = self._resolve_user_id(username_or_id)
        self.client.update(_TABLE, {"code_id": code_id}, {
            "status": "active",
            "user_id": uid,
            "activated_at": to_iso(datetime.now()),
            "expires_at": to_iso(datetime.combine(expires_at, datetime.min.time())),
        })
