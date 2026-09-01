## Why

pg-schema-self-check 归档当晚即实证两处盲区：①门禁 REQUIRED 清单漏掉 payments 域六张表（tiers/skus/orders/trade_events/reconciliation_reports/invoices，payments_repo.py 经同一 pg_http 通道读写），清单违反自身"覆盖仓储层全部读写表"的规格；②加列只建列不带 server_default 的漂移已实际发生（users.deletion_status 无 DEFAULT → 新注册行落 NULL → 注销 CAS eq.'正常' 永不匹配），而存在性/类型探测均检不出默认值缺失。

## What Changes

- REQUIRED 清单补录 payments 域六表全列（43→123 列）。
- 新增 EXPECTED_DEFAULTS 稀疏清单（24 个语义承重的 server_default 对拍基准）。
- 探测通道新增网关根 OpenAPI 元数据对拍（GET 端点根路径 → swagger definitions 的 default 字段，实测与库内一致）：不一致计入 `mismatch`，门禁 exit 1、启动自检告警。
- 索引不在 OpenAPI 元数据内，维持 D7 盲区登记（仅性能影响，正确性无涉）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `pg-schema-self-check`: 必需清单覆盖面扩至 payments 域；新增 server_default 对拍需求（mismatch 计入拦截/告警）。

## Impact

- `server/app/infrastructure/pg_schema.py`（清单 + EXPECTED_DEFAULTS + probe_all 三元组）
- `server/app/infrastructure/repositories/pg_http/client.py`（describe()）
- `server/scripts/pg_gate.py`（mismatch → exit 1）
- `server/tests/unit/test_pg_schema.py`（默认值对拍三用例 + 根路径 mock 适配）
- 无用户可见界面改动；生产实测 `schema ok tables=11 columns=123` 通过。
