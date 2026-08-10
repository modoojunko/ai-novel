# 前端两态地基（003-two-tier-foundation）

## Why

PRD v1.1 定位「免费 = 完整人工写作能力；PRO = 同一界面 + AI 解锁」。现状前端把套餐判定散落各处，无法支撑改版的两态能力显隐：

- **tier 无单一数据源**：`NovelPage.tsx:121-125` 与 `NovelListPage.tsx:69-72` 各自 `post /auth/verify` 取一次 tier，结果不共享、可能重复请求。
- **无能力注册表**：功能显隐靠逐处 `if (tier === 'none')` 硬编码（C1/N14 明令禁止），改版后 free/PRO 能力清单（12 键）无法统一维护。
- **无两态渲染原语**：需要 `<TierGate>` / `<TierField>` 一套组件承载「免费隐藏 AI 入口 / 显示 🔒 属 PRO」的渲染，避免逐点复制。
- **NovelLayout 是空壳**（B7）：`pages/NovelLayout.tsx` 仅 `AuthGuard + Outlet`，缺项目壳（书名/加载态共享数据），后续 004 工作台纵切无处挂载。

## What Changes

### 新增能力 `tier-gating`（FE-01 / FE-02 / FE-03）

1. `components/novel/license/LicenseProvider.tsx`：React Context。挂载时**一次** `api.post("/auth/verify")` 取 `{tier, trial_remaining_days}`，module 级缓存避免重复请求；下发 `{tier, isFree, isPro, trialRemainingDays, loading, error, refetch}`；网络失败降级 `tier="none"`（免费兜底，不抛 500）。
2. `hooks/useTier.ts`：`useContext(LicenseContext)`，未包 Provider 返回安全免费默认值。
3. `lib/features.ts`：`FeatureKey` 联合类型 + `FEATURES: Record<FeatureKey, {free: boolean}>` + 纯函数 `isFeatureEnabled(key, tier)`。免费 ✅ 7 键；免费 🔒 5 键（AI 属 PRO）。运营判定（限 1 本/试用横幅）不进清单，保留直判。
4. `components/novel/license/FeatureTier.tsx`：`<TierGate feature>`（不可用不渲染子树）+ `<TierField feature locked>`（锁定态显示 🔒/「属 PRO」，保留字段骨架）。

### 新增能力 `project-shell`（FE-04）

5. `pages/NovelLayout.tsx`：`AuthGuard → LicenseProvider → ProjectShell → Outlet`。
6. `hooks/useProject.ts` + `ProjectShell`：`api.get(/novels/{id})` 一次，Context 下发 `{project, loading, error}`；加载骨架复用 NovelPage 现有 skeleton。

## Impact

- 前端新增：`components/novel/license/LicenseProvider.tsx`、`components/novel/license/FeatureTier.tsx`、`hooks/useTier.ts`、`hooks/useProject.ts`、`lib/features.ts`、`components/novel/license/ProjectShell.tsx`。
- 前端改造：`pages/NovelLayout.tsx`。
- 测试：新增前端 vitest 单测（features 清单两态矩阵 / TierGate/TierField 渲染 / LicenseProvider 缓存与降级）。
- 兼容：`/auth/verify` 仍只读不改；NovelPage 现有的 `setProject`/`setUserTier` 局部状态**不**在本 change 移除（改在 004 工作台纵切时收敛），仅新增 Provider 供后代消费。

## Rollout

1. `lib/features.ts` 能力清单（FE-02）→ `isFeatureEnabled` 纯函数
2. `LicenseProvider` + `useTier`（FE-01）
3. `FeatureTier`（TierGate/TierField，FE-03）
4. `NovelLayout` 挂载 + `useProject`/`ProjectShell`（FE-04）
5. 前端 vitest 单测（TE-15）+ `npx tsc --noEmit` 验收
