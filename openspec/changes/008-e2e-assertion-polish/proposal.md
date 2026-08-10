# E2E 断言打磨 + 回归收口（008-e2e-assertion-polish）

## Why

change 006 把卷章树读整体切到 DB（`GET /volumes`/`GET /tree` 以 `volumes`/`chapters` 表为准）、写路径停写 vol YAML 内嵌列表；change 007 补写/归档路径 DB 同步 + unarchive + genre 表面化。**E2E 断言打磨**（change 006 design 归入 change 008）尚未验证：两条 flow spec（`creation-flow` + `free-writing-flow`）是针对新 UI 写的，但从未在当前代码上完整跑过一轮——docker 前端镜像是 sprint 前的旧构建（09:43 vs 现 dist 18:13），跑 E2E 会测到旧代码。

测试收尾需回答：**跑当前代码的完整 E2E 是否绿？** 若有断言漂移（DB 树迁移、归档 📦 同步、unarchive 恢复按钮、genre 显示），就地打磨。

## What Changes

### TE-01 当前代码跑通两条 flow spec

- 以本地 Vite dev（当前源码，`/api` 代理 → docker client-backend:8000）启动 E2E 目标，`E2E_BASE_URL` 指向 dev 端口，**不重建 docker 前端镜像**。
- 免费主流程 `free-writing-flow.spec.ts`（change 004）：建书直达正文、树 CRUD、实时字数/自动保存、免费归档不 500 + 树 📦、零 phase-status。
- PRO/创建流程 `creation-flow.spec.ts`：建书、设定门控、EmptyState 无门控直写、改名。

### TE-02 断言漂移打磨

DB 树迁移（change 006）与 archive sync（change 007）后可能漂移的断言，按实际失败就地修正，保持断言反映新行为：
- 树从 DB 读 → 建章/归档后树的即时性。
- 归档后树 📦（`free-writing-flow` 已有断言，确认仍绿）。
- 可选：归档阅读器「恢复」（BE-05 unarchive）若入口稳定，补一条往返断言；入口不稳则不硬补（P2，防 flaky）。

### TE-03 全量回归门禁

收口标准：后端 `pytest tests/` 全绿（当前 313）+ 前端 `tsc --noEmit` / `vitest`（44）/ `npm run build` 全绿 + 两条 E2E flow spec 绿。

## Impact

- 修改：`e2e/free-writing-flow.spec.ts`、`e2e/creation-flow.spec.ts`（断言打磨，按需）。
- 不动业务代码（002-007 已收口；若打磨发现业务缺陷，另立 change 处理，不混入）。
- 无新后端/前端业务变更。

## Rollout

1. 起本地 Vite dev（空闲端口）→ `E2E_BASE_URL` 指向 dev
2. 跑 `free-writing-flow` + `creation-flow`，记录失败项
3. 按失败打磨断言（TE-02），重跑至绿
4. 全量回归（pytest + tsc + vitest + build）确认收口
