## Context

主能力已归档（#254）。当晚两次实证新盲区：清单漏 payments 六表；加列漏 server_default（users.deletion_status → 注销 CAS 失效），经 MCP 补 DDL 修复。可行性已实测：网关根 OpenAPI（GET 端点根路径）返回 swagger definitions，列 default 字段与库内 server_default 一致（bool/int 原生类型、str 原样、空串可辨）。

## Goals / Non-Goals

**Goals:** 清单覆盖 payments 域；语义承重 server_default 纳入门禁与自检判定。
**Non-Goals:** 索引对拍（OpenAPI 无此元数据，维持盲区）；nullable/maxLength 对拍（模型声明与迁移的一致性由 sqlite 链 alembic 保证，生产仅需防漏列/漏默认）；非文本列间类型漂移（原 D7 盲区不变）。

## Decisions

### D8 server_default 对拍走网关根 OpenAPI
`client.describe()`：GET `{endpoint}/` → `definitions`，一次请求获得全部表的列 default 元数据。与存在性探测同通道同凭据，不引 SQL 直连。
- 归一化比较：bool→"true"/"false"，int→str，str 原样；期望空串时接受元数据缺省渲染。
- 稀疏声明（EXPECTED_DEFAULTS 只列代码逻辑依赖其默认值的列，如 CAS 过滤值、状态机初值）；func.now() 时间戳默认不纳入。
- 根 OpenAPI 不可得 → probe_failed=openapi，fail-closed（门禁 exit 3），启动自检只告警。
- 否决替代：INSERT 探测默认值（污染生产数据）；管理 API 直查 information_schema（逆向集成，D6 已否）。

### D9 payments 六表入 REQUIRED
payments_repo.py 走同一 PgRestClient，清单契约要求全覆盖。列清单按 models/payments.py 全列收录（ORM 全列读写），类型族：字符串 text、其余（int/bool/date/JSON）typed。

## Risks / Trade-offs

- [根 OpenAPI 被网关关闭] → probe_failed fail-closed，部署中止可见；不会静默漏检。
- [orders 列多（30 列）探测请求变大] → 单请求 select 全列实测 200，体量无虞。

## Migration Plan

纯代码增量随 PR 合入 main 自动部署；无 DB 变更。生产已实测 `schema ok tables=11 columns=123`。

## Open Questions

（无）
