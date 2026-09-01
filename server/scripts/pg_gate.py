"""部署前生产 schema 门禁（design D5）：探测生产 PG 必需表/列，缺失即 exit 非零。

由 s-server-deploy.yml 在「部署后端」步骤之前调用；判定逻辑与启动自检同源
（app.infrastructure.pg_schema.probe_all），缺列清单可直接作为 MCP 应用 DDL 的依据。

用法（CI）：TCB_PG_ENV_ID / TCB_PG_API_KEY 环境变量注入后 `python scripts/pg_gate.py`。
退出码：0=齐备放行；1=缺失表/列或 server_default 漂移；2=凭据缺失；3=探测失败（fail-closed，re-run 重试）。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.infrastructure.pg_schema import REQUIRED, probe_all
from app.infrastructure.repositories.pg_http.client import PgRestClient


def main() -> int:
    env_id = os.environ.get("TCB_PG_ENV_ID", "")
    api_key = os.environ.get("TCB_PG_API_KEY", "")
    if not env_id or not api_key:
        print("pg_gate: 缺少 TCB_PG_ENV_ID / TCB_PG_API_KEY 环境变量", file=sys.stderr)
        return 2

    endpoint = f"https://{env_id}.api.tcloudbasegateway.com/v1/rdb/rest"
    client = PgRestClient(endpoint, api_key, timeout=15.0)
    missing, probe_failed, mismatch = probe_all(client)

    if probe_failed:
        print("pg_gate: 探测失败（网络/网关，fail-closed，可 re-run 重试）:")
        for item in probe_failed:
            print(f"  - {item}")
        return 3
    if missing or mismatch:
        if missing:
            print("pg_gate: 生产 PG schema 缺失，本次部署中止。缺失清单（可直接作为 MCP DDL 依据）:")
            for item in missing:
                print(f"  - {item}")
        if mismatch:
            print("pg_gate: server_default 漂移，本次部署中止。修复形态=ALTER COLUMN SET DEFAULT / 回填:")
            for item in mismatch:
                print(f"  - {item}")
        return 1
    print(
        f"pg_gate: schema ok tables={len(REQUIRED)} "
        f"columns={sum(len(cols) for cols in REQUIRED.values())}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
