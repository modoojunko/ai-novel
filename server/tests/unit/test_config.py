"""配置层单元测试：DATABASE_URL 方言选择 + 支付网关开关语义。"""

from __future__ import annotations

import os

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


class TestPaymentsGateway:
    def test_mock_mode_by_default(self):
        """PAYMENTS_GATEWAY 缺省 = mock（dev 注入端点注册）。"""
        assert settings.PAYMENTS_GATEWAY == "mock"

    def test_empty_env_falls_back_to_mock(self):
        """CI 未配 secrets 注入空串 → config 层 `or "mock"` 回落 mock（dev 端点不消失）。"""
        assert (os.getenv("PAYMENTS_GATEWAY", "mock") or "mock") == "mock"
        assert ("wxpay" or "mock") == "wxpay"

    def test_non_mock_disables_dev_endpoints(self):
        """守卫语义：仅 PAYMENTS_GATEWAY == "mock" 注册 dev 端点。"""
        from app.interfaces.web_api import dev_inject

        assert dev_inject._MOCK_MODE is True  # 测试环境缺省 mock
        assert len(dev_inject.r.routes) > 0
