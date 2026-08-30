"""SQL（SQLAlchemy/SQLite）激活码仓储。

2026-08-30 代理键迁移：codes 表 FK 从 username(String) 改为 user_id(BigInteger)。
仓储层接受 username 字符串，内部经 UserORM 解析为 user_id。
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from app.domain.licensing import ActivationCode
from app.models.code import ActivationCodeORM
from app.models.user import UserORM


class SqlCodeRepo:
    def __init__(self, db: Session):
        self.db = db

    def _resolve_user_id(self, username: str) -> int | None:
        row = self.db.query(UserORM.id).filter(UserORM.username == username).first()
        return row[0] if row else None

    @staticmethod
    def _to_domain(row: ActivationCodeORM) -> ActivationCode:
        return ActivationCode(
            code_id=row.code_id,
            tier=row.tier,
            duration_days=row.duration_days,
            status=row.status,
            user_id=row.user_id,
            expires_at=row.expires_at,
            activated_at=row.activated_at,
            created_at=row.created_at,
            created_by=row.created_by or "",
        )

    def get(self, code_id: str) -> ActivationCode | None:
        row = self.db.query(ActivationCodeORM).filter(ActivationCodeORM.code_id == code_id).first()
        return self._to_domain(row) if row else None

    def find_all_by_username(self, username: str) -> list[ActivationCode]:
        uid = self._resolve_user_id(username)
        if uid is None:
            return []
        rows = (
            self.db.query(ActivationCodeORM)
            .filter(ActivationCodeORM.user_id == uid)
            .order_by(ActivationCodeORM.activated_at.desc())
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def find_active_by_username(self, username: str) -> list[ActivationCode]:
        uid = self._resolve_user_id(username)
        if uid is None:
            return []
        rows = (
            self.db.query(ActivationCodeORM)
            .filter(
                ActivationCodeORM.user_id == uid,
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
        # user_id 可以是 int（代理键）或 str（username，需解析）
        uid = code.user_id
        if isinstance(uid, str):
            uid = self._resolve_user_id(uid)

        row = ActivationCodeORM(
            code_id=code.code_id,
            tier=code.tier,
            duration_days=code.duration_days,
            status=code.status,
            user_id=uid,  # int 或 None（未绑定码）
            created_by=code.created_by,
        )
        self.db.add(row)

    def activate(self, code_id: str, username: str, expires_at: date) -> None:
        uid = self._resolve_user_id(username)
        self.db.query(ActivationCodeORM).filter(ActivationCodeORM.code_id == code_id).update({
            "status": "active",
            "user_id": uid,
            "activated_at": datetime.now(),
            "expires_at": datetime.combine(expires_at, datetime.min.time()),
        })
