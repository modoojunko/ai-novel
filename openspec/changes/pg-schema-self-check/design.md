## Context

- 生产 = CloudBase PG，`DB_BACKEND=pg_http`：唯一数据通道是 PostgREST 兼容网关（`PgRestClient`），无 SQL 直连（体验版 PG 无 TCP 直连，见 cloudbase-pg-httprest 模式）；`app/main.py` 启动分支在此直接 return，不跑 alembic。
- sqlite 后端启动时自动 `alembic upgrade head` + `create_all`，schema 由迁移链保证。
- 现有结构化日志风格为 `event=app.xxx key=value`（logger 名 `app`），自检日志沿用。
- 仓储层实际读写的表共 5 张：`users` / `codes` / `device_registry` / `device_grants` / `global_config`。

## Goals / Non-Goals

**Goals:**
- pg_http 启动时一次性探测全部必需表/列，缺失打一条聚合告警，通过打一条 info 留痕。
- 探测失败（网络层）不阻断启动，不抛异常。

**Non-Goals:**
- 不做自动修复（不自动加列）——生产 DDL 仍走人工/MCP 审批路径。
- 不做周期巡检、不接告警系统、不改 healthcheck 语义。
- 不覆盖 sqlite 模式。

## Decisions

### D1 探测通道：复用 PostgREST `?select=` 列探测，不引 SQL 直连
新增 `PgRestClient.probe_columns(table, cols)`：`GET /{table}?select=<col1>,<col2>&limit=1`。
- 200 = 全部列存在（判据是 HTTP 状态码，空表返回 `[]` 同样算通过，不依赖行数）；
- 404 = 表缺失；
- 400（PGRST204 未知列）= 再逐列探测，定位出缺失列名。

**2026-08-31 事故增补——文本列类型探测**：`device_registry.user_id` 生产为 bigint 而代码预期 varchar 时，`select` 探测照样 200，存在性探测检不出类型漂移（当日实测）。故对清单内 **text 族列**追加哨兵探测 `probe_type(table, col)`：`?select=<col>&<col>=eq.<哨兵>&limit=1`——200=存在且为文本族；400+错误码 `22P02`=列存在但类型不符；400+`PGRST204`/`42703`=缺列。错误码从响应体 JSON `code` 提取（网关包装形如 `DATABASE_22P02`）。

否决的替代：查 `information_schema`（pg_http 无 SQL 通道，引直连违背既有架构决策）；PostgREST root OpenAPI 一次拿全 schema（CloudBase 网关不保证开放 root 文档，解析重量级）。

### D2 必需清单：单一事实源 `app/infrastructure/pg_schema.py`
`REQUIRED: dict[str, tuple[tuple[str, str], ...]]`，元素为 `(列名, 类型族)`——`text`=字符串语义列（哨兵探测存在性+类型），`typed`=数值/时间/布尔列（仅存在性探测）。按仓储层实际读写列维护，2026-08-31 对照 `app/models/` 与各 `pg_http/*_repo.py` 终审（初版清单与仓储出入：补 `users.id`/`deletion_*` 四列、`codes.user_id/order_id/grant_start/status_detail/refund_requested_at`、`device_registry.updated_at`；`device_grants` 实际无数值列外键解读差异，以仓储代码为准）。此后新增表/列的 feature change 必须同 PR 更新清单。

```python
REQUIRED = {
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
```

否决的替代：从 SQLAlchemy models 自动推导——pg_http 与 ORM 无耦合，PG 预建表本就不由 models 生成，自动推导会造出第二套真相。

### D3 告警不阻断，聚合单条日志
`main.py` pg_http 分支在 return 前同步执行自检（5 个轻量 GET，冷启动路径可接受；不异步化，避免"已接流量但告警未出"的窗口）。整体 try/except 包裹；单表探测异常按"探测失败"记入结果继续。

日志契约（logger `app`，一条聚合）：
- 通过：`event=app.schema_check result=ok tables=5 columns=N`
- 缺失：`event=app.schema_check result=fail missing=users.theme,codes.expires_at probe_failed=global_config`（`missing`/`probe_failed` 仅在有内容时出现，逗号分隔 `表.列` / 表名）

否决的替代：启动失败/healthcheck 置失败——缺列通常只降级个别写路径（如 theme），把整服务打成不可用是放大事故，且云托管缩零下启动失败会反复触发冷启动；日志告警足够部署日暴露，告警系统对接留给后续。

### D4 自检入口为独立函数
`app/infrastructure/pg_schema.py` 提供 `run_schema_check(client) -> None`（内部完成探测与日志），`main.py` 仅一行调用——保持启动分支薄、单测直接打函数。

### D5 CI 门禁：部署步骤前置探测，缺列即中止
`s-server-deploy.yml` 在「部署后端」步骤**之前**插入门禁步骤：跑 `server/scripts/pg_gate.py`（httpx 同步请求），复用 `pg_schema.REQUIRED` 清单与同一套状态码判定（200 齐 / 404 缺表 / 400 逐列复探定缺失列）；任一缺失即打印清单并 exit 1，流水线在发布任何产物前终止。

- 凭据现成：`vars.TCB_ENV_ID` + `secrets.TCB_API_KEY`，端点按 `config.py` 同款规则拼 `https://<envId>.api.tcloudbasegateway.com/v1/rdb/rest`。
- 识别点映射：S端 无 tag/Release 体系，push main 的自动部署就是唯一上线动作，门禁即"release 时识别数据库表变更"的落点。
- 门禁判定只回答"缺什么"，不回答"对应哪个 migration 文件"——生产 PG 从不由 alembic 管理（无 alembic_version），做版本对比需要维护第二套迁移账本；缺列清单本身就是 MCP 应用 DDL 的直接依据，够用且不会两套账本漂移。

### D6 应用路径：MCP 人工授权，不做 CI 自动 DDL
门禁拦截后按 SOP（写入 `server/README.md`）：会话内 CloudBase MCP 设备码登录（用户浏览器授权）→ `managePgDatabase` 执行对应 DDL → 重跑部署（workflow_dispatch / re-run）。否决 CI 自动加列：DDL 变更生产 schema 属高危写操作，必须人工授权与审阅；且 CI 内复刻 MCP 的管理 API 属逆向集成，脆弱。

**2026-08-31 事故增补**：SOP 必须含「改列类型/重建表后的连接池刷新」步骤——rdb 网关连接池缓存旧查询预编译计划（bigint 时代模板），仅改表不杀连接则旧查询模板继续 400（`DATABASE_22P02`），必须 `pg_terminate_backend` 杀光连接逼池子重建；`NOTIFY pgrst` 对该网关实测无效。

### D7 类型对拍的边界（known limitation）
PostgREST 通道下，文本→数值互错可检（哨兵探测 22P02，当日事故形态）；数值↔时间戳、数值精度等**非文本列之间的类型漂移不可检**（select 探测只答存在性）。彻底对拍需 SQL 直连查 `information_schema`，违背 D1 架构决策，接受此边界并在此登记；若未来事故形态落在盲区，再议引入只读 SQL 通道。

### 两道防线的关系
门禁（CI，上线前拦截）为主，启动自检（运行时告警）为兜底——覆盖手工部署、MCP 部署绕过流水线、以及 DDL 应用后 PostgREST 网关 schema 缓存未刷新等边缘态。两者共享同一 `REQUIRED` 清单与判定逻辑（清单在 app 包内，门禁脚本 import 同一份），加列 feature change 只需同步一处。

## Risks / Trade-offs

- [清单与实际 schema 漂移（加列忘更新清单）] → 清单更新与 feature change 同 PR 强制绑定（tasks 终审步骤 + 本文 D2 约定）；漏更新最多造成"该报不报"，不会误报阻断。
- [CloudBase 网关对 `select=`/错误码语义差异] → 与现有 `find()` 同通道同参数编码，风险低；单测 MockTransport 锁行为，部署终验看一条 `result=ok` 日志。
- [误报噪音] → 仅启动执行一次；无周期探测。

## Migration Plan

纯代码变更随 push main 自动部署，无 DB 变更、无数据迁移。回滚 = revert PR 重部署。上线终验：云托管日志出现 `event=app.schema_check result=ok`；演练路径：本地 pg_http 环境删列复现 `result=fail` 告警且服务可启动。

## Open Questions

（无）
