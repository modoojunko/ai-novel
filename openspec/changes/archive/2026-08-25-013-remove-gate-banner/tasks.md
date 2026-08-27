# 013-remove-gate-banner — Tasks

## 1. 删组件与 state

- [x] 1.1 删除 `src/components/novel/GateBanner.tsx` 整文件
- [x] 1.2 `useNovelState.ts`：删 `GateWarning` 接口、`warnings` state、`setWarnings(res.warnings || [])`、返回对象中 `warnings` 字段
- [x] 1.3 `api.ts`：`fetchPhaseStatus` 注释去掉 "and gate warnings"

## 2. NovelWorkspace 收敛

- [x] 2.1 删 `import GateBanner`
- [x] 2.2 删 `onGoAdvanced`（调用处 :77 + ProPhaseSurface props 两处 :134/:140）
- [x] 2.3 删 `bannerDismissed` state、`handleDismissBanner`、`{!bannerDismissed && <GateBanner/>}` 渲染块
- [x] 2.4 删 synopsis 滚动定位 effect（`initialPanel === "synopsis"` 分支 + `scrollIntoView`），`initialPanel` 逻辑简化为 `initialPanel ?? "world"`，更新相关注释
- [x] 2.5 `ProContainer.tsx:6` 注释去掉 GateBanner（N14 结构不动）

## 3. E2E 断言机制替换

- [x] 3.1 `creation-flow.spec.ts:279`：测试标题改「设定 7 项全确认（settings-status 全绿）」；删 banner 相关断言（:286 初始「尚未完成设定」可见、:352-353 消失断言）；改新增 `apiGetJSON` helper；最终断言 `GET /novels/{id}/settings/status` 7 键全 true
- [x] 3.2 `creation-flow.spec.ts` 文件头注释（:17-19）同步「设定完成判定」描述

## 4. 回归

- [x] 4.1 `tsc --noEmit` ✓（0 错误）
- [x] 4.2 `vitest run` ✓（51 passed，NovelWorkspace/ProContainer 全绿，mock 的 warnings 保留）
- [x] 4.3 `npm run build` ✓
- [x] 4.4 `playwright test --list` ✓（24 用例编译通过）
- [x] 4.5 `openspec validate 013-remove-gate-banner --type change` → valid
