"""CloudBase PG HTTP API 设备注册仓储。"""
from __future__ import annotations

import uuid
from datetime import datetime

from app.domain.devices import DeviceRegistry
from app.infrastructure.repositories.pg_http.client import (
    PgRestClient,
    parse_dt,
    to_iso,
)

_TABLE = "device_registry"


class PgHttpDeviceRepo:
    def __init__(self, client: PgRestClient):
        self.client = client

    @staticmethod
    def _to_domain(doc: dict) -> DeviceRegistry:
        return DeviceRegistry(
            id=doc["id"],
            user_id=doc["user_id"],
            fingerprint=doc.get("fingerprint", "") or "",
            hostname=doc.get("hostname", "") or "",
            os=doc.get("os", "") or "",
            os_arch=doc.get("os_arch", "") or "",
            last_active_at=parse_dt(doc.get("last_active_at")),
            bound_at=parse_dt(doc.get("bound_at")),
            created_at=parse_dt(doc.get("created_at")),
            updated_at=parse_dt(doc.get("updated_at")),
        )

    def get_by_fingerprint(self, user_id: str, fingerprint: str) -> DeviceRegistry | None:
        doc = self.client.find_one(_TABLE, {"user_id": user_id, "fingerprint": fingerprint})
        return self._to_domain(doc) if doc else None

    def list_by_user(self, user_id: str) -> list[DeviceRegistry]:
        docs = self.client.find(_TABLE, {"user_id": user_id}, sort=[("last_active_at", "desc")])
        return [self._to_domain(d) for d in docs]

    def upsert(self, device: DeviceRegistry) -> DeviceRegistry:
        now = datetime.now()
        existing = self.client.find_one(_TABLE, {
            "user_id": device.user_id, "fingerprint": device.fingerprint,
        })
        if existing:
            self.client.update(
                _TABLE,
                {"user_id": device.user_id, "fingerprint": device.fingerprint},
                {
                    "hostname": device.hostname,
                    "os": device.os,
                    "os_arch": device.os_arch,
                    "last_active_at": to_iso(now),
                    "updated_at": to_iso(now),
                },
            )
            return DeviceRegistry(
                id=existing["id"],
                user_id=device.user_id,
                fingerprint=device.fingerprint,
                hostname=device.hostname,
                os=device.os,
                os_arch=device.os_arch,
                last_active_at=now,
                bound_at=parse_dt(existing.get("bound_at")),
                created_at=parse_dt(existing.get("created_at")),
                updated_at=now,
            )
        # 省略时间戳字段：数据库 DEFAULT now()
        doc_id = uuid.uuid4().hex
        self.client.insert(_TABLE, {
            "id": doc_id,
            "user_id": device.user_id,
            "fingerprint": device.fingerprint,
            "hostname": device.hostname,
            "os": device.os,
            "os_arch": device.os_arch,
        })
        return DeviceRegistry(
            id=doc_id,
            user_id=device.user_id,
            fingerprint=device.fingerprint,
            hostname=device.hostname,
            os=device.os,
            os_arch=device.os_arch,
            last_active_at=now,
            bound_at=now,
            created_at=now,
            updated_at=now,
        )

    def delete_by_id(self, device_id: str, user_id: str) -> bool:
        return self.client.delete(_TABLE, {"id": device_id, "user_id": user_id}) > 0
