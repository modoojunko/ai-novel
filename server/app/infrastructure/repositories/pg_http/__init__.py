"""CloudBase PG HTTP API 仓储实现（PostgREST + API Key）。"""
from __future__ import annotations

from app.config import settings
from app.infrastructure.repositories.pg_http.client import PgRestClient

_pg_client: PgRestClient | None = None


def get_pg_client() -> PgRestClient:
    """模块级单例：按 settings 构建 PostgREST 客户端（测试可直接替换 _pg_client）。"""
    global _pg_client
    if _pg_client is None:
        if not settings.TCB_PG_API_KEY or not settings.TCB_PG_ENDPOINT:
            raise RuntimeError(
                "DB_BACKEND=pg_http 需要设置 TCB_PG_ENV_ID 与 TCB_PG_API_KEY（环境 API Key）"
            )
        _pg_client = PgRestClient(settings.TCB_PG_ENDPOINT, settings.TCB_PG_API_KEY)
    return _pg_client
