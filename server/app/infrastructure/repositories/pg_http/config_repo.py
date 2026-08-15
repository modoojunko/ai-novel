"""CloudBase PG HTTP API 全局配置仓储。"""
from __future__ import annotations
from app.infrastructure.repositories.pg_http.client import PgRestClient

_TABLE = "global_config"


class PgHttpConfigRepo:
    def __init__(self, client: PgRestClient):
        self.client = client

    def get(self, key: str, default: str = "") -> str:
        doc = self.client.find_one(_TABLE, {"key": key})
        return doc["value"] if doc else default
