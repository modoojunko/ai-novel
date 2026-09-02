## 1. 清单与对拍实现

- [x] 1.1 `pg_schema.py`：REQUIRED 补录 payments 六表（43→123 列）；新增 EXPECTED_DEFAULTS（24 项）与 `_audit_defaults`；`probe_all` 三元组（missing/probe_failed/mismatch）；验收=unit 90/90 绿
- [x] 1.2 `client.describe()`：根 OpenAPI → definitions，非 200/非 JSON 返回 None；验收=MockTransport 三态单测绿
- [x] 1.3 `pg_gate.py`：mismatch → exit 1（清单形态 `表.列#default(期望值)`）；验收=生产实跑 `schema ok tables=11 columns=123`

## 2. 验证与入库

- [x] 2.1 ruff 全绿；验收=对四个改动文件零告警
- [x] 2.2 全量 pytest：等主工作区并发会话的迁移链收敛（alembic multi-head 修复）后重跑；验收=全量绿（2026-09-02 复跑：274 passed / 8.71s，multi-head 已收敛）
- [x] 2.3 PR 合入后部署 run 门禁实战 `tables=11`：验收=run 日志贴 PR（#257 已于 09-01 合入；09-02 #270 触发的部署 run 33584725849「生产 schema 门禁」step success，当日早间 GitHub runner 手动探针同证 `schema ok tables=11 columns=124`）
