# PRO 态隐藏顶栏「高级配置」下拉（010-pro-hide-advanced-dropdown）

## Why

PRO 态下「设定/大纲/正文/归档」出现双入口：阶段 tabs（`ProPhaseSurface`，仅 PRO 渲染）与顶栏 NovelBar「高级配置 ▾」下拉（无条件渲染）重复。设计分工本意是：**下拉是免费态专属入口**（免费态 `ProContainer` 整棵不渲染、无阶段 tabs，靠下拉进入设定/大纲/归档），PRO 态由阶段 tabs 承担全部四态。NovelBar 未按 `isFree` 条件渲染导致 PRO 态下拉冗余。

## What Changes

1. `components/novel/NovelBar.tsx`：「高级配置 ▾」下拉整体包进 `isFree && (...)`——PRO 态隐藏，免费态保留（免费用户唯一入口）。
2. `components/novel/EmptyState.tsx` + `Workbench.tsx`：EmptyState 空项目引导区的「高级配置」按钮加 `hideAdvanced` prop，PRO 态（阶段 tabs 已提供设定/大纲）隐藏。
3. `__tests__/NovelWorkspace.test.tsx`：新增 PRO 态断言「阶段 tabs 四入口存在 + 顶栏下拉不渲染」。
4. `e2e/creation-flow.spec.ts`：两处 PRO（trial）用例进设定由「高级配置 ▾ → 设定」改为点阶段 tab「设定」；删除不再被引用的 `openAdvanced` helper。
5. `e2e/free-writing-flow.spec.ts`：免费态「高级配置」选择器由 `getByRole(name exact)` 改为 `getByTitle("高级配置（设定/大纲）")`——免费态空项目时 NovelBar 下拉与 EmptyState 按钮并存，原选择器 strict mode 会匹配两个。

## Impact

- 前端修改：`NovelBar.tsx`、`EmptyState.tsx`、`Workbench.tsx`、`NovelWorkspace.test.tsx`、`creation-flow.spec.ts`、`free-writing-flow.spec.ts`。
- 免费态行为不变（NovelBar 下拉 + EmptyState 引导都在，E2E `free-writing-flow` 依赖它们）。
- 无后端改动。

## Rollout

1. NovelBar 条件渲染 → 单测（免费保留 / PRO 隐藏）
2. E2E spec 同步 PRO 用例入口
3. 回归：`tsc --noEmit` + `vitest run` + `npm run build` + E2E spec 编译
4. `openspec validate 010-pro-hide-advanced-dropdown --type change`
