"""配置层单元测试：DATABASE_URL 方言选择。"""

from __future__ import annotations

from app.config import settings


class TestDatabaseUrl:
    def test_default_is_sqlite(self):
        """未设置 DATABASE_URL 时回退 SQLite（本地/测试默认）。"""
        assert settings.DATABASE_URL.startswith("sqlite:///")

    def test_follows_db_path_override(self):
        """测试覆盖 DB_PATH 后（契约测试模式），连接串跟随新路径。"""
        original = settings.DB_PATH
        try:
            settings.DB_PATH = "/tmp/license-test.db"
            assert settings.DATABASE_URL == "sqlite:////tmp/license-test.db"
        finally:
            settings.DB_PATH = original
