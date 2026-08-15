"""SQL（SQLAlchemy/SQLite）全局配置仓储。"""
from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.config import GlobalConfigORM


class SqlConfigRepo:
    def __init__(self, db: Session):
        self.db = db

    def get(self, key: str, default: str = "") -> str:
        row = self.db.query(GlobalConfigORM).filter(GlobalConfigORM.key == key).first()
        return row.value if row else default
