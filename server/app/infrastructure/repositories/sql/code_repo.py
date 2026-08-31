"""SQL（SQLAlchemy/SQLite）激活码仓储。"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from app.domain.licensing import ActivationCode
from app.models.code import ActivationCodeORM


class SqlCodeRepo:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(row: ActivationCodeORM) -> ActivationCode:
        return ActivationCode(
            code_id=row.code_id,
            tier=row.tier,
            duration_days=row.duration_days,
            status=row.status,
            bound_username=row.bound_username or "",
            expires_at=row.expires_at,
            activated_at=row.activated_at,
            created_at=row.created_at,
            created_by=row.created_by or "",
        )

    def get(self, code_id: str) -> ActivationCode | None:
        row = self.db.query(ActivationCodeORM).filter(ActivationCodeORM.code_id == code_id).first()
        return self._to_domain(row) if row else None

    def find_all_by_username(self, username: str) -> list[ActivationCode]:
        rows = (
            self.db.query(ActivationCodeORM)
            .filter(ActivationCodeORM.bound_username == username)
            .order_by(ActivationCodeORM.activated_at.desc())
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def find_active_by_username(self, username: str) -> list[ActivationCode]:
        rows = (
            self.db.query(ActivationCodeORM)
            .filter(
                ActivationCodeORM.bound_username == username,
                ActivationCodeORM.status == "active",
            )
            .order_by(ActivationCodeORM.activated_at.desc())
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def find_all(self, limit: int = 200) -> list[ActivationCode]:
        rows = (
            self.db.query(ActivationCodeORM)
            .order_by(ActivationCodeORM.created_at.desc())
            .limit(limit)
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def create(self, code: ActivationCode) -> None:
        row = ActivationCodeORM(
            code_id=code.code_id,
            tier=code.tier,
            duration_days=code.duration_days,
            status=code.status,
            bound_username=code.bound_username or None,  # 空串→NULL，避免 FK 引用空用户
            created_by=code.created_by,
        )
        self.db.add(row)

    def activate(self, code_id: str, username: str, expires_at: date) -> None:
        self.db.query(ActivationCodeORM).filter(ActivationCodeORM.code_id == code_id).update({
            "status": "active",
            "bound_username": username,
            "activated_at": datetime.now(),
            "expires_at": datetime.combine(expires_at, datetime.min.time()),
        })

    def revoke_unconsumed_for_user(self, username: str) -> int:
        """注销执行：unused（待激活）+ active（排队中/消耗中）全部置 revoked。返回行数。"""
        result = self.db.query(ActivationCodeORM).filter(
            ActivationCodeORM.bound_username == username,
            ActivationCodeORM.status.in_(["unused", "active"]),
        ).update({"status": "revoked"}, synchronize_session=False)
        self.db.commit()
        return result

    def find_unconsumed_by_username(self, username: str) -> list[ActivationCode]:
        rows = (
            self.db.query(ActivationCodeORM)
            .filter(
                ActivationCodeORM.bound_username == username,
                ActivationCodeORM.status.in_(["unused", "active"]),
            )
            .order_by(ActivationCodeORM.activated_at.desc())
            .all()
        )
        return [self._to_domain(r) for r in rows]
