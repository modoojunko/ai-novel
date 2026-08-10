# 010-pro-hide-advanced-dropdown — Tasks

## FE-01 NovelBar 条件渲染
- [x] `NovelBar.tsx`：「高级配置 ▾」包进 `isFree &&`（PRO 隐藏 / 免费保留）

## FE-02 EmptyState 引导区按钮
- [x] `EmptyState.tsx`：新增 `hideAdvanced` prop，PRO 态不渲染「高级配置」按钮
- [x] `Workbench.tsx`：`useTier()` → `hideAdvanced={!isFree}`

## FE-03 测试同步
- [x] `NovelWorkspace.test.tsx`：新增 PRO 态「下拉隐藏 + tabs 四入口」断言
- [x] `creation-flow.spec.ts`：两处 PRO 用例改点阶段 tab「设定」，删除孤儿 `openAdvanced` helper
- [x] `free-writing-flow.spec.ts`：免费态「高级配置」选择器改 `getByTitle` 去歧义（双按钮并存）

## FE-04 回归
- [x] `tsc --noEmit` ✓
- [x] `vitest run` 49 passed
- [x] `npm run build` ✓
- [x] `playwright test --list` 编译通过（9 用例 / 2 spec）
- [x] 本地 PRO 态无头验证：顶栏下拉 `topbarAdvanced=0`、tabs 四入口在
- [x] `openspec validate 010-pro-hide-advanced-dropdown --type change` → valid
