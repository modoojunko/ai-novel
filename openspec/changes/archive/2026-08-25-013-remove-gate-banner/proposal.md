## Why

PRO 工作台上「以下阶段尚未就绪」门控横幅（`GateBanner`）随 phase-status 列出未确认设定，与「建书即写」目标冲突，且其信息已被设定树「已设定」徽标与顶栏导航取代。产品评估结论：

1. `gate_settings_complete` 是软门控（`hard_block=False`，从不 400 阻断），「催促」语义与实际行为不符。
2. 硬门控（prompt/write）的错误是英文技术串，在横幅里对用户无展示价值；真实错误由 400 响应的结构化 `failures` 承载。
3. 新建 PRO 小说初始即 8 条警告，与「建书即写」直接矛盾。
4. `hardGate` 分支是无调用方的死代码。

故将横幅整体移除，阶段就绪状态交由设定树确认徽标表达。

## What Changes

- **REMOVED** PRO-only `GateBanner` 组件（含死代码 `hardGate` 分支）。
- `useNovelState` 移除 `warnings` state 与 `GateWarning` 接口（唯一消费方即 GateBanner）；`/workflow/phase-status` 照常返回 warnings，前端不再读取。
- `NovelWorkspace` 移除 banner 渲染、`bannerDismissed` state 与 `localStorage`（`gate-banner-dismissed-*`）、`onGoAdvanced` 面板跳转，以及「去补充 → 简介卡」专用的 synopsis 滚动定位 effect（`panel:"synopsis"` 唯一入口即 banner 跳转）。
- E2E：`creation-flow.spec.ts`「设定 7 项全确认后门控横幅消失」改断言机制——最终断言改为直接校验 `GET /settings/status` 7 项全确认（保留 PRD 3.4 的回归价值：world/hooks 真实表单保存结构）。
- 后端**零改动**：`workflow/gates.py`/`router.py` 继续计算并返回 warnings（软门控语义不变，契约测试不动）。

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `novel-workspace`（004-free-workspace 引入）：PRO 容器内不再渲染 GateBanner 阶段催促横幅；原「付费态渲染阶段催促 UI」场景移除 banner。

## Impact

- **前端源码**：删 `GateBanner.tsx`；改 `useNovelState.ts`（warnings 三件套）、`NovelWorkspace.tsx`（banner/onGoAdvanced/synopsis 跳转）、`api.ts` 注释、`ProContainer.tsx` 注释。
- **测试**：`NovelWorkspace.test.tsx` / `ProContainer.test.tsx` 的 `warnings: []` mock 保留（API 响应形状不变，hook 只是不再读它）；无任何断言依赖 banner 可见 → 零改动。E2E `free-writing-flow.spec.ts:130` 与 `creation-flow.spec.ts:247` 是「无 banner」absence 断言 → 仍成立，零改动。
- **后端**：无改动。N14（免费态零 phase-status 请求）不受影响——`ProContainer` 结构与 `useNovelState` 挂载点不变。
