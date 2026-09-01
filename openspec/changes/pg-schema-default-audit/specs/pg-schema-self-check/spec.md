## Purpose

（既有能力 pg-schema-self-check 的增量：清单覆盖面与默认值对拍，Purpose 见主 spec。）

## MODIFIED Requirements

### Requirement: pg_http 启动自检

服务以 pg_http 后端启动时，系统 MUST 在开始对外服务前，对维护清单中每张必需表的全部必需列各执行一次存在性探测（探测走既有 PG HTTP 通道，不引入 SQL 直连）。必需表/列清单 MUST 覆盖仓储层实际读写的全部表与列（含 payments 域仓储：tiers/skus/orders/trade_events/reconciliation_reports/invoices）。

#### Scenario: 全部表列齐备
- **WHEN** 生产库包含清单内所有必需表及必需列
- **THEN** 启动日志出现一条 info 级 `event=app.schema_check` 记录，`result=ok`，并携带探测的表数与列数

#### Scenario: payments 域表纳入清单
- **WHEN** payments 域任一表（如 orders）在生产库缺失
- **THEN** 自检缺失项中可见该表名，门禁按缺失拦截部署

### Requirement: server_default 对拍

清单 MAY 按列声明语义承重的期望 server_default。探测 MUST 经网关根 OpenAPI 元数据（既有 PG HTTP 通道）比对实际默认值；不一致 MUST 计入 `mismatch` 清单，与缺失同待遇：门禁拦截部署、启动自检告警。元数据不可得时 MUST 按"探测失败"降级，不阻断启动。

#### Scenario: 默认值漂移拦截（实证形态）
- **WHEN** 某声明了期望默认值的列在生产库存在但默认值缺失或不符（如 deletion_status 无 DEFAULT，新注册行落 NULL 使注销 CAS 永不匹配）
- **THEN** 门禁日志可见 `表.列#default(期望值)` 并 exit 1 中止部署
- **THEN** 启动自检日志 `mismatch=` 字段可见同一清单，服务照常启动

#### Scenario: 元数据不可得降级
- **WHEN** 网关根 OpenAPI 不可得（非 200 或非 JSON）
- **THEN** 该项按探测失败（probe_failed=openapi）记账，不抛异常、不阻断启动；门禁按探测失败 fail-closed
