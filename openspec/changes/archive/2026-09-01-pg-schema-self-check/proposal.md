## Why

生产 CloudBase PG 的表结构不随部署迁移（pg_http 启动分支直接 return，CI 也没有迁移步骤），全靠人工执行 DDL。theme-preferences（#221）就因漏执行生产加列，上线后主题保存 500、刷新回退，直到用户报障才定位。需要一道机器防线，让"代码上线了、列没加"的漂移在部署当天就从日志暴露，而不是等用户撞上。

## What Changes

- **部署前门禁（识别）**：S端 自动部署流水线在部署后端**之前**，用与启动自检同源的必需清单探测生产库；发现缺失表/列即中止本次部署（后端与前端均不发布）并输出缺失清单——把"识别数据库表变更"前移到上线动作之前。说明：S端 没有 tag/Release 体系，唯一上线动作是 push main 触发的自动部署，识别点即部署流水线前置步骤（若未来引入 S端 tag 发版，门禁同样挂在其部署步骤前）。
- **应用路径（MCP）**：门禁拦截后，按发布 SOP 在会话内经 CloudBase MCP（设备码登录授权）用 `managePgDatabase` 应用对应 DDL，然后重跑部署——新版本上线前完成加列。
- S端 后端在 `DB_BACKEND=pg_http` 启动时，对生产 PG 的**必需表与必需列**做一次自检（复用现有 PostgREST 探测通道，不引入 SQL 直连），作为门禁被绕过时的运行时兜底。
- 自检发现缺失表/缺失列时，输出一条结构化告警日志（`event=app.schema_check` + 缺失清单），**不阻断启动**——缺列只应降级个别写路径，不应把整个服务打成不可用。
- 自检通过时输出一条 info 级日志留痕（表/列计数），部署验证时可在云托管日志里直接确认。
- sqlite 后端行为不变：该模式启动本就自动跑 alembic，无需自检与门禁。

## Capabilities

### New Capabilities
- `pg-schema-self-check`: S端 pg_http 启动时的生产 PG schema 自检——必需表/列清单、探测方式、缺失告警与通过留痕的日志契约。

### Modified Capabilities

（无——不改动任何既有能力的规格行为。）

## Impact

- `.github/workflows/s-server-deploy.yml`（新增"生产 schema 门禁"步骤，位于部署后端之前）
- `server/scripts/` 门禁脚本（复用必需清单 + PostgREST 探测，缺列 exit 非零阻断部署）
- `server/README.md`（发布 SOP：门禁拦截 → MCP 设备码登录 → managePgDatabase 应用 DDL → 重跑部署）
- `server/app/main.py`（pg_http 启动分支接入自检调用）
- 新增 `server/app/infrastructure/` 下 schema 自检模块（必需表/列清单 + 探测逻辑）
- `server/app/infrastructure/repositories/pg_http/client.py`（新增按列探测方法）
- `server/tests/`（MockTransport 单测，沿用 test_pg_http_repos.py 模式）
- 无用户可见界面改动，无双端共享段触碰，免原型。
