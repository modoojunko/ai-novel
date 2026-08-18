"""配置层单元测试：DATABASE_URL 方言选择。"""

from __future__ import annotations

from app.config import settings


class TestDatabaseUrl:
    def test_default_is_sqlite(self):
        """未设置 DATABASE_URL 时回退 SQLite（本地/测试默认）。

        集成 conftest 已把 DATABASE_URL 指向临时 SQLite，这里只验证方言。"""
        assert settings.DATABASE_URL.startswith("sqlite:///")

    def test_follows_db_path_override(self, monkeypatch):
        """测试覆盖 DB_PATH 后（契约测试模式），连接串跟随新路径。

        需先摘掉集成 conftest 注入的 DATABASE_URL（属性在 env 缺省时才回退 DB_PATH）。"""
        monkeypatch.delenv("DATABASE_URL", raising=False)
        original = settings.DB_PATH
        try:
            settings.DB_PATH = "/tmp/license-test.db"
            assert settings.DATABASE_URL == "sqlite:////tmp/license-test.db"
        finally:
            settings.DB_PATH = original
