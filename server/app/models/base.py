from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""


# 方言由 DATABASE_URL 决定：本地默认 SQLite（不支持并发写入，同步无意义），
# 生产（CloudBase 云托管）为 PostgreSQL（postgresql:// 连接串，psycopg2 驱动）。
_connect_args = {"timeout": 10} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=_connect_args)

SessionLocal = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """SQLite 连接时设置 PRAGMA（PostgreSQL 默认开启外键/无 WAL，跳过）。"""
    if engine.dialect.name != "sqlite":
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


def get_db():
    """FastAPI Depends 用：请求级 DB session。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
