"""生产 PG schema 自检：必需表/列清单单一事实源 + 探测编排。

清单按仓储层（pg_http/*_repo.py）实际读写的表与列人工维护；每列标注类型族：
- "text"  字符串语义列：存在性之外再用 filter 哨兵验证类型（2026-08-31 事故实证：
          select 存在性探测检不出 bigint→varchar 漂移，device_registry.user_id 即此形态）
- "typed" 数值/时间/布尔列：仅做存在性探测（非文本列之间的类型漂移为本方案盲区，见 design D7）

此后新增表/列的 feature change 必须同 PR 更新本清单（design D2 约定）。
"""
from __future__ import annotations

import logging

import httpx

from app.infrastructure.repositories.pg_http.client import PgRestClient

logger = logging.getLogger("app")

# (列名, 类型族)；类型族仅 "text" / "typed" 两种
REQUIRED: dict[str, tuple[tuple[str, str], ...]] = {
    "users": (
        ("id", "typed"), ("username", "text"), ("password_hash", "text"),
        ("security_question", "text"), ("security_answer_hash", "text"),
        ("status", "text"), ("theme", "text"), ("created_at", "typed"),
        ("deletion_status", "text"), ("deletion_requested_at", "typed"),
        ("deletion_deadline", "typed"), ("deletion_waive_assets", "typed"),
    ),
    "codes": (
        ("code_id", "text"), ("tier", "text"), ("duration_days", "typed"),
        ("status", "text"), ("user_id", "typed"), ("bound_username", "text"),
        ("order_id", "typed"), ("grant_start", "typed"), ("status_detail", "text"),
        ("activated_at", "typed"), ("expires_at", "typed"),
        ("created_at", "typed"), ("created_by", "text"), ("refund_requested_at", "typed"),
    ),
    "device_registry": (
        ("id", "text"), ("user_id", "text"), ("fingerprint", "text"),
        ("hostname", "text"), ("os", "text"), ("os_arch", "text"),
        ("last_active_at", "typed"), ("bound_at", "typed"),
        ("created_at", "typed"), ("updated_at", "typed"),
    ),
    "device_grants": (
        ("pc_hash", "text"), ("user_id", "typed"), ("token", "text"),
        ("enrolled", "typed"), ("fingerprint", "text"),
    ),
    "global_config": (("key", "text"), ("value", "text")),
}

_PROBE_SENTINEL = "__pg_schema_probe__"


def _check_table(client: PgRestClient, table: str, cols: tuple[tuple[str, str], ...],
                 missing: list[str], probe_failed: list[str]) -> None:
    """单表探测：存在性（批量+缺失复探）→ text 列哨兵类型探测。异常只记账不抛。"""
    try:
        status, code, table_missing = client.probe_columns(table, [name for name, _ in cols])
    except httpx.TransportError:
        probe_failed.append(table)
        return
    if status == 404:
        missing.append(table)
        return
    if status == 400:
        # 表存在但批量 select 撞未知列（PGRST204）→ 复探结果即缺失清单；
        # 复探后仍无缺失属矛盾态（400 必因缺列），兜底记探测失败
        if table_missing:
            missing.extend(table_missing)
        else:
            probe_failed.append(table)
        return
    if status != 200:
        probe_failed.append(table)
        return
    for name, kind in cols:
        if kind != "text":
            continue
        try:
            col_status, code = client.probe_type(table, name, _PROBE_SENTINEL)
        except httpx.TransportError:
            probe_failed.append(f"{table}.{name}")
            continue
        if col_status == 400 and ("22P02" in code or "PGRST" in code or "42703" in code):
            # 22P02=类型不符（如 bigint 列收到文本哨兵）；PGRST204/42703=缺列
            missing.append(f"{table}.{name}")
        elif col_status != 200:
            probe_failed.append(f"{table}.{name}")


def probe_all(client: PgRestClient) -> tuple[list[str], list[str]]:
    """探测全部必需表/列，返回 (missing, probe_failed)。门禁与启动自检共用的判定核心。"""
    missing: list[str] = []
    probe_failed: list[str] = []
    for table, cols in REQUIRED.items():
        _check_table(client, table, cols, missing, probe_failed)
    return missing, probe_failed


def run_schema_check(client: PgRestClient) -> None:
    """探测全部必需表/列，聚合单条日志（design D3 契约）。绝不抛异常。"""
    missing, probe_failed = probe_all(client)

    if missing or probe_failed:
        detail = []
        if missing:
            detail.append("missing=" + ",".join(missing))
        if probe_failed:
            detail.append("probe_failed=" + ",".join(probe_failed))
        logger.warning("event=app.schema_check result=fail %s", " ".join(detail))
    else:
        logger.info(
            "event=app.schema_check result=ok tables=%d columns=%d",
            len(REQUIRED), sum(len(cols) for cols in REQUIRED.values()),
        )
