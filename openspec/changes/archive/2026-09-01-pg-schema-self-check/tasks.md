## 1. 清单与探测通道

- [x] 1.1 新建 `server/app/infrastructure/pg_schema.py`：`REQUIRED` 清单（design D2 五表）+ `run_schema_check(client)`；对照 `app/models/` 与各 `pg_http/*_repo.py` 逐列终审清单，验收=清单与仓储实际读写列零出入（纸上核对记录进 PR 描述）
- [x] 1.2 `PgRestClient` 新增 `probe_columns(table, cols)`：`?select=col1,col2&limit=1`，按 HTTP 状态码判 200/404/400，400 时逐列复探返回缺失列名；验收=ruff + 既有单测全绿

## 2. 启动接入

- [x] 2.1 `app/main.py` pg_http 分支接入 `run_schema_check`：整体 try/except，聚合单条日志（ok/fail 契约见 design D3）；sqlite 分支不感知；验收=本地 pg_http 模式（MockTransport）启动日志出现 schema_check
- [x] 2.2 单测（沿 test_pg_http_repos.py 的 MockTransport 模式）：全齐备→ok 日志；缺列→fail+missing 含 `表.列` 且其余表继续探测；缺表→fail 含表名；探测网络异常→probe_failed 且不抛；验收=pytest 全绿

## 3. 部署前门禁（CI 识别 + MCP 应用）

- [x] 3.1 新建 `server/scripts/pg_gate.py`：import `pg_schema.REQUIRED`，httpx 按 `TCB_PG_ENV_ID`/`TCB_PG_API_KEY` 探测（与 D1 同状态码判定），缺失打印清单并 exit 1；验收=本地对生产实跑一次输出 ok（当前生产已齐备）
- [x] 3.2 `s-server-deploy.yml` 在「部署后端」前插入 schema 门禁步骤（env 注入 vars.TCB_ENV_ID + secrets.TCB_API_KEY）；验收=推一条不含 schema 变更的 main 触发部署，门禁步骤通过且部署完成
- [x] 3.3 拦截演练：本地把脚本指向缺列清单（或临时改 REQUIRED 加一个不存在的列）实跑，验收=exit 非零且日志含缺失项；演练后还原
- [x] 3.4 `server/README.md` 新增「生产 schema 变更 SOP」：门禁拦截 → 会话内 MCP 设备码登录 → managePgDatabase 应用 DDL → 重跑部署 → 云托管日志验 `schema_check ok`；验收=文档评审通过，流程含回滚说明（revert PR）

## 4. 门禁与终验

- [x] 4.1 后端门禁全绿：`ruff check` + `pytest`（容器内全量）；验收=本地命令输出零失败
- [x] 4.2 部署后终验：push main 自动部署完成，云托管日志检索到 `event=app.schema_check result=ok tables=5`；验收=日志截图/文本贴入 PR
