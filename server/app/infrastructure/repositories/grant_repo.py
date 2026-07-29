from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.grant import DeviceGrantORM
from app.domain.devices import DeviceGrant


class GrantRepo:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(row: DeviceGrantORM) -> DeviceGrant:
        return DeviceGrant(
            pc_hash=row.pc_hash,
            username=row.username,
            token=row.token,
            enrolled=bool(row.enrolled),
            fingerprint=row.fingerprint or "",
        )

    def get(self, pc_hash: str) -> DeviceGrant | None:
        row = self.db.query(DeviceGrantORM).filter(DeviceGrantORM.pc_hash == pc_hash).first()
        return self._to_domain(row) if row else None

    def upsert(self, pc_hash: str, username: str, token: str, enrolled: bool, fingerprint: str) -> None:
        row = self.db.query(DeviceGrantORM).filter(DeviceGrantORM.pc_hash == pc_hash).first()
        if row:
            row.username = username
            row.token = token
            row.enrolled = 1 if enrolled else 0
            row.fingerprint = fingerprint
        else:
            row = DeviceGrantORM(
                pc_hash=pc_hash,
                username=username,
                token=token,
                enrolled=1 if enrolled else 0,
                fingerprint=fingerprint,
            )
            self.db.add(row)

    def set_enrolled(self, pc_hash: str, username: str, enrolled: bool) -> None:
        self.db.query(DeviceGrantORM).filter(
            DeviceGrantORM.pc_hash == pc_hash,
            DeviceGrantORM.username == username,
        ).update({"enrolled": 1 if enrolled else 0})
