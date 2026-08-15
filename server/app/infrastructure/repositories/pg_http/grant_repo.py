"""CloudBase PG HTTP API 设备授权凭证仓储。"""
from __future__ import annotations
from app.infrastructure.repositories.pg_http.client import PgRestClient
from app.domain.devices import DeviceGrant

_TABLE = "device_grants"


class PgHttpGrantRepo:
    def __init__(self, client: PgRestClient):
        self.client = client

    @staticmethod
    def _to_domain(doc: dict) -> DeviceGrant:
        return DeviceGrant(
            pc_hash=doc["pc_hash"],
            username=doc["username"],
            token=doc["token"],
            enrolled=bool(doc.get("enrolled", False)),
            fingerprint=doc.get("fingerprint", "") or "",
        )

    def get(self, pc_hash: str) -> DeviceGrant | None:
        doc = self.client.find_one(_TABLE, {"pc_hash": pc_hash})
        return self._to_domain(doc) if doc else None

    def upsert(self, pc_hash: str, username: str, token: str, enrolled: bool, fingerprint: str) -> None:
        existing = self.client.find_one(_TABLE, {"pc_hash": pc_hash})
        if existing:
            self.client.update(_TABLE, {"pc_hash": pc_hash}, {
                "username": username,
                "token": token,
                "enrolled": 1 if enrolled else 0,
                "fingerprint": fingerprint,
            })
        else:
            # 省略 created_at：数据库 DEFAULT now()
            self.client.insert(_TABLE, {
                "pc_hash": pc_hash,
                "username": username,
                "token": token,
                "enrolled": 1 if enrolled else 0,
                "fingerprint": fingerprint,
            })

    def set_enrolled(self, pc_hash: str, username: str, enrolled: bool) -> None:
        self.client.update(
            _TABLE,
            {"pc_hash": pc_hash, "username": username},
            {"enrolled": 1 if enrolled else 0},
        )
