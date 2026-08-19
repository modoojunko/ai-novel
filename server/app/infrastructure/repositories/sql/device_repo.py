"""SQL（SQLAlchemy/SQLite）设备注册仓储。"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.domain.devices import DeviceRegistry
from app.models.device import DeviceRegistryORM


class SqlDeviceRepo:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(row: DeviceRegistryORM) -> DeviceRegistry:
        return DeviceRegistry(
            id=row.id,
            user_id=row.user_id,
            fingerprint=row.fingerprint or "",
            hostname=row.hostname or "",
            os=row.os or "",
            os_arch=row.os_arch or "",
            last_active_at=row.last_active_at,
            bound_at=row.bound_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def get_by_fingerprint(self, user_id: str, fingerprint: str) -> DeviceRegistry | None:
        row = self.db.query(DeviceRegistryORM).filter(
            DeviceRegistryORM.user_id == user_id,
            DeviceRegistryORM.fingerprint == fingerprint,
        ).first()
        return self._to_domain(row) if row else None

    def list_by_user(self, user_id: str) -> list[DeviceRegistry]:
        rows = (
            self.db.query(DeviceRegistryORM)
            .filter(DeviceRegistryORM.user_id == user_id)
            .order_by(DeviceRegistryORM.last_active_at.desc())
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def upsert(self, device: DeviceRegistry) -> DeviceRegistry:
        existing = self.db.query(DeviceRegistryORM).filter(
            DeviceRegistryORM.user_id == device.user_id,
            DeviceRegistryORM.fingerprint == device.fingerprint,
        ).first()
        now = datetime.now()
        if existing:
            existing.hostname = device.hostname
            existing.os = device.os
            existing.os_arch = device.os_arch
            existing.last_active_at = now
            existing.updated_at = now
            return self._to_domain(existing)
        else:
            row = DeviceRegistryORM(
                id=uuid.uuid4().hex,
                user_id=device.user_id,
                fingerprint=device.fingerprint,
                hostname=device.hostname,
                os=device.os,
                os_arch=device.os_arch,
                last_active_at=now,
                bound_at=now,
                updated_at=now,
            )
            self.db.add(row)
            return self._to_domain(row)

    def delete_by_id(self, device_id: str, user_id: str) -> bool:
        result = self.db.query(DeviceRegistryORM).filter(
            DeviceRegistryORM.id == device_id,
            DeviceRegistryORM.user_id == user_id,
        ).delete()
        return result > 0
