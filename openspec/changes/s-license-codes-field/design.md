## Context

明细分页改造（license-grants-pagination）把明细从总览内嵌搬到了独立端点 `/license/grants`，并在总览新增 `grant_count`——对象始终是 codes 表行（行内主键 `code_id`），grant 是借词。消费面（09-03 grep）：后端 5 文件（payments.py + repo base/pg_http/sql 三处方法名）、前端 4 文件 75 处（pay.ts 类型与 URL、LicensePage、OrderDetailPage 一处、e2e mock/spec）、pytest 2 文件。`LicenseView.grants?` 内嵌明细字段已是死字段（后端不再内嵌、前端零消费），直接删除。

## Goals / Non-Goals

**Goals**
- URI `/license/codes`、总览 `code_count`、订单快照 `code`、全链符号 License*/find_order_codes_page/list_license_codes
- 旧路径别名 + 旧字段双发覆盖部署窗口；收尾删除判据=线上 bundle 零引用
- `grant_start` 裁定保留并入档（含 DB 列名）

**Non-Goals**
- codes 表列名/任何 schema 变更
- pending_count、items 行内字段名（本就 code 语义）
- 归档历史、client_api

## Decisions

### D1 双发而非别名式"只换"：字段层用新旧并出一期

URI 层沿用别名 decorator；**字段层**（code_count/grant_count、code/grant）同响应内两键同值并出——JSON 字段无法"redirect"，旧 tab 里已加载的旧前端包只认旧键，双发是唯一不破坏窗口的方式；判据=线上 bundle grep 旧键=0 后删旧键（同 #286 节奏）。

### D2 死字段直接删

`LicenseView.grants?`（内嵌明细）后端已不返回、前端零消费（grep 证实），类型层直接删除，不留过渡——没有消费者就没有兼容问题。

### D3 CSS 类随行改名

`.grant-row` 等行类是明细行的视觉钩子，行对象更名 code 则类名同步 `code-row`（e2e locator 同批），避免下一轮"类名为什么叫 grant"的困惑。视觉零变化（纯类名替换）。

### D4 仓储方法名三处同批

`find_order_grants_page` 是 base 抽象 + pg_http/sql 双实现，一处不改即接口漂移——同批 git 级替换并在 pytest（sqlite 路径）与部署门禁兜底。

## Risks / Trade-offs

- [窗口期旧 tab 拿不到新键] → D1 双发；收尾判据后才删
- [worktree 外部进程回退] → 编辑→验证→推送最小化 + gh api 字节级 cmp 校验（#285 后成规）
- [repo 三处方法名漏改] → grep 验收项单列 + 接口签名 pytest 全量兜底
- [附录 Z 与实现漂移] → 总览行/分页行/订单详情行同批更新

## Migration Plan

单 PR → CI → 合并 → 自动部署 → 线上验证（license 含双计数键、orders/{no} 含双快照键、codes 路径 200/旧行为同）→ 前端线上包核验零旧引用 → 收尾小 PR 删旧字段/旧路径别名 → 终态复验 → 归档。回滚 revert 即回，无 schema 变更。

## Open Questions

（无。）
