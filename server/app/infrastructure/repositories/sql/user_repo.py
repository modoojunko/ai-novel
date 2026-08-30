"""SQL（SQLAlchemy/SQLite）用户仓储。"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.domain.identity import User
from app.models.user import UserORM


class SqlUserRepo:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(row: UserORM) -> User:
        return User(
            username=row.username,
            password_hash=row.password_hash,
            status=row.status,
            security_question=row.security_question or "",
            security_answer_hash=row.security_answer_hash or "",
            created_at=row.created_at,
            theme=row.theme or "",
        )

    def get_id(self, username: str) -> int | None:
        """username → user_id（代理键解析 helper，2026-08-30 新增）。"""
        row = self.db.query(UserORM.id).filter(UserORM.username == username).first()
        return row[0] if row else None

    def get(self, username: str) -> User | None:
        row = self.db.query(UserORM).filter(UserORM.username == username).first()
        return self._to_domain(row) if row else None

    def exists(self, username: str) -> bool:
        return self.db.query(UserORM).filter(UserORM.username == username).first() is not None

    def create(self, user: User) -> User:
        row = UserORM(
            username=user.username,
            password_hash=user.password_hash,
            security_question=user.security_question,
            security_answer_hash=user.security_answer_hash,
            status=user.status,
        )
        self.db.add(row)
        return user

    def update_password(self, username: str, new_password_hash: str) -> None:
        self.db.query(UserORM).filter(UserORM.username == username).update(
            {"password_hash": new_password_hash}
        )

    def update_security(self, username: str, question: str, answer_hash: str) -> None:
        self.db.query(UserORM).filter(UserORM.username == username).update(
            {"security_question": question, "security_answer_hash": answer_hash}
        )

    def update_theme(self, username: str, theme: str) -> None:
        self.db.query(UserORM).filter(UserORM.username == username).update(
            {"theme": theme}
        )

    def flush(self) -> None:
        """确保用户已持久化，后续试用码 FK 不失败。"""
        self.db.flush()
