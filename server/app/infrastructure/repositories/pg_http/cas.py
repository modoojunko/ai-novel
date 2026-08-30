"""PgRestClient CAS 扩展：compare_and_update + 唯一冲突语义。

设计依据：backend-detail-design.md §2.12 / §3.1。
"""
from __future__ import annotations

from typing import Any

import httpx


class CASLost(Exception):
    """CAS 竞态：WHERE 条件不匹配，0 行被更新。"""

    def __init__(self, table: str, pk_filter: str, expected: str):
        self.table = table
        self.pk_filter = pk_filter
        self.expected = expected
        super().__init__(f"CAS lost: {table} {pk_filter} expected {expected}")


class UniqueConflict(Exception):
    """INSERT 撞唯一约束。"""

    def __init__(self, table: str, constraint_hint: str = ""):
        self.table = table
        self.constraint_hint = constraint_hint
        super().__init__(f"Unique constraint conflict: {table} {constraint_hint}")


def extend_pg_rest_client(client: PgRestClient) -> None:
    """给 PgRestClient 实例注入 CAS 方法（monkey-patch 风格，避免改类定义）。"""

    def compare_and_update(
        table: str,
        pk_filter: dict[str, Any],
        cas_condition: dict[str, Any],
        changes: dict[str, Any],
    ) -> dict | None:
        """CAS 更新：WHERE pk AND cas_condition → SET changes。

        Returns:
            更新后的行（dict）；CAS 输（0 行）返回 None。
        """
        merged_filter = {**pk_filter, **cas_condition}
        # None 值序列化为 JSON null（PostgREST 省略字段会应用 DEFAULT）
        body = {}
        for k, v in changes.items():
            if v is not None:
                body[k] = v
            else:
                body[k] = None  # 显式 null 才能写 NULL

        resp = client._client.patch(
            f"{client._endpoint}/{table}",
            params=client._build_params(merged_filter),
            json=body,
            headers={"Prefer": "return=representation"},
        )
        resp.raise_for_status()
        rows = resp.json() if resp.content else []
        return rows[0] if rows else None

    def insert_or_conflict(table: str, doc: dict) -> bool:
        """INSERT，撞唯一约束返回 False（不抛异常）。"""
        resp = client._client.post(
            f"{client._endpoint}/{table}",
            json=doc,
        )
        if resp.status_code in (400, 409):
            # PostgREST 唯一约束错误（PGRST 系列 4xx）
            return False
        resp.raise_for_status()
        return True

    def insert_returning(table: str, doc: dict) -> dict:
        """INSERT 并返回插入的行（Prefer: return=representation）。"""
        resp = client._client.post(
            f"{client._endpoint}/{table}",
            json=doc,
            headers={"Prefer": "return=representation"},
        )
        resp.raise_for_status()
        return resp.json()[0] if resp.json() else {}

    # 注入方法
    client.compare_and_update = compare_and_update
    client.insert_or_conflict = insert_or_conflict
    client.insert_returning = insert_returning
