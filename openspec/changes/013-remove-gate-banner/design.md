# 013-remove-gate-banner — Design

## Context

GateBanner 是 PRO 专属的阶段催促横幅，唯一消费 `useNovelState.warnings`。产品评估（见 proposal Why）判定其信息已被设定树确认徽标 + 顶栏导航取代，整体移除。本设计覆盖移除的实现边界与 E2E 断言机制替换。动机见 `proposal.md - Why`，需求见 `specs/novel-workspace/spec.md`。

## Goals / Non-Goals

**Goals**
- 彻底移除 GateBanner 渲染与支撑代码（组件 / warnings state / bannerDismissed 记忆 / 面板跳转）。
- 保留 PRD 3.4「设定 7 项全确认」的 E2E 回归价值。
- 保持后端契约与 N14（免费零 phase-status）不动。

**Non-Goals**
- 不改后端：`gates.py`/`router.py` 照常计算返回 warnings，前端忽略。
- 不移除 OnboardingCard（正向引导，非阶段催促警告）。
- 不清理 011/012 已造成的 004 spec 表述陈旧——仅在本次 MODIFIED 里忠实反映当前架构（3 label 已在 ProContainer 外），不扩范围重写其他需求。

## Decisions

### D1：warnings 从 `useNovelState` 返回值中移除

`GateBanner` 是 `warnings` 唯一消费方（grep 确认：无其他组件读取）。`phaseStatus` 仍被 `allPhasesPending`（OnboardingCard 显隐）使用，保留。`setWarnings(res.warnings || [])` 一并删除，API 响应形状不变。

**替代方案**：保留 warnings 在 hook 返回值（YAGNI）→ 留死代码，否决。

### D2：synopsis 滚动定位 effect 一并删除

`panel:"synopsis"` 的唯一入口是 GateBanner「去补充 → 简介卡」（grep 确认：`go("advanced-settings", { panel })` 仅由 `onGoAdvanced` 调用，而 `onGoAdvanced` 仅 GateBanner 的 onJump 消费）。banner 移除后该 effect 与 `initialPanel !== "synopsis"` 特判成为死代码，一并删除；`initialPanel` 逻辑简化为 `initialPanel ?? "world"`。

### D3：E2E 断言机制替换为 `GET /settings/status` 直查

原测试「设定 7 项全确认后门控横幅消失」用 banner 消失当观察点。移除后改为：7 项全部确认后，直接 `GET /novels/{id}/settings/status` 断言 `synopsis/genre/world/style/anti-ai/hooks/characters` 7 键全 true。

**为什么**：banner 消失 ⟺ gate 重算无未确认 ⟺ settings-status 全 true——直查后端状态与旧断言是同一个事实，且保住 world/hooks 真实表单保存结构回归（PRD 3.4 核心价值），不依赖任何被删 UI。测试标题改为「设定 7 项全确认（settings-status 全绿）」。

**替代方案**：断言 OnboardingCard 消失（allPhasesPending 变 false）→ 依赖 phase-status 二跳，间接且脆，否决。

### D4：测试 mock 的 `warnings: []` 保留

`NovelWorkspace.test.tsx` / `ProContainer.test.tsx` mock 返回完整 API 响应 `{ phases, warnings: [] }`——API 形状不变，保留即真实。无断言依赖 banner **可见**（仅 absence 断言，删除后仍成立）→ 零改动。

## Risks / Trade-offs

- **[011/012 遗留的 004 spec 陈旧]** → 本次 MODIFIED 忠实反映当前架构（3 label 已出 ProContainer），不扩范围；若后续归档 004 需独立核对历史 delta 链。
- **[E2E 直查后端弱化 UI 覆盖]** → 设定面板的「完成设定 → 已设定」逐项断言仍在（world/hooks 走真实表单），UI 路径覆盖未降；仅最终观察点换后端。
- **[本地 bannerDismissed localStorage 残留]** → 无写入方即自然失效，无清理必要（精准修改）。

## Migration Plan

1. 删 `GateBanner.tsx`。
2. `useNovelState.ts` 删 warnings 三件套。
3. `NovelWorkspace.tsx` 删 import / `onGoAdvanced`（3 处）/ `bannerDismissed` + `handleDismissBanner` / 渲染块 / synopsis effect / `initialPanel` 特判。
4. `api.ts` / `ProContainer.tsx` 注释同步。
5. `creation-flow.spec.ts:279` 断言机制替换。
6. 回归：`tsc --noEmit` + `vitest run` + `npm run build` + E2E spec 编译。
7. `openspec validate 013-remove-gate-banner --type change`。

回滚：全部为前端删除型变更，git revert 即回滚；后端无迁移。

## Open Questions

无。
