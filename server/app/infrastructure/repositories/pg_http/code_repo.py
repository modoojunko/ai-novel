"""CloudBase PG HTTP API 激活码仓储。"""
from __future__ import annotations

from datetime import date, datetime

from app.domain.licensing import ActivationCode
from app.infrastructure.repositories.pg_http.client import (
    PgRestClient,
    parse_dt,
    to_iso,
)

_TABLE = "codes"


class PgHttpCodeRepo:
    def __init__(self, client: PgRestClient):
        self.client = client

    @staticmethod
    def _to_domain(doc: dict) -> ActivationCode:
        return ActivationCode(
            code_id=doc["code_id"],
            tier=doc["tier"],
            duration_days=doc["duration_days"],
            status=doc["status"],
            user_id=doc.get("user_id", "") or "",
            expires_at=parse_dt(doc.get("expires_at")),
            activated_at=parse_dt(doc.get("activated_at")),
            created_at=parse_dt(doc.get("created_at")),
            created_by=doc.get("created_by", "") or "",
        )

    def get(self, code_id: str) -> ActivationCode | None:
        doc = self.client.find_one(_TABLE, {"code_id": code_id})
        return self._to_domain(doc) if doc else None

    def find_all_by_username(self, username: str) -> list[ActivationCode]:
        docs = self.client.find(_TABLE, {"user_id": username}, sort=[("activated_at", "desc")])
        return [self._to_domain(d) for d in docs]

    def find_active_by_username(self, username: str) -> list[ActivationCode]:
        docs = self.client.find(
            _TABLE,
            {"user_id": username, "status": "active"},
            sort=[("activated_at", "desc")],
        )
        return [self._to_domain(d) for d in docs]

    def find_all(self, limit: int = 200) -> list[ActivationCode]:
        docs = self.client.find(_TABLE, sort=[("created_at", "desc")], limit=limit)
        return [self._to_domain(d) for d in docs]

    def create(self, code: ActivationCode) -> None:
        # 不传时间戳键：created_at 走数据库 DEFAULT now()，expires_at/activated_at 保持 NULL
        # user_id 空串→null：NULL 不触发 FK 检查（codes.user_id → users.username）
        self.client.insert(_TABLE, {
            "code_id": code.code_id,
            "tier": code.tier,
            "duration_days": code.duration_days,
            "status": code.status,
            "user_id": code.user_id or None,
            "created_by": code.created_by,
        })

    def activate(self, code_id: str, username: str, expires_at: date) -> None:
        self.client.update(_TABLE, {"code_id": code_id}, {
            "status": "active",
            "user_id": username,
            "activated_at": to_iso(datetime.now()),
            "expires_at": to_iso(datetime.combine(expires_at, datetime.min.time())),
        })
