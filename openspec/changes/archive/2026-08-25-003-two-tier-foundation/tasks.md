# 前端两态地基 — Tasks

> FE-01 / FE-02 / FE-03 / FE-04 ｜ TE-15

## 前端（tier-gating）

- [ ] `lib/features.ts`：`FeatureKey` 联合类型 + `FEATURES` 清单（免费 7 键 ✅ / 锁定 5 键 🔒）+ `isFeatureEnabled(key, tier)` 纯函数（FE-02）
- [ ] `components/novel/license/LicenseProvider.tsx`：React Context + module 级缓存 + `/auth/verify` 一次取 + 失败降级 `tier="none"` + `refetch`（FE-01）
- [ ] `hooks/useTier.ts`：`useContext` 取上下文，未包 Provider 返回安全免费默认值（FE-01）
- [ ] `components/novel/license/FeatureTier.tsx`：`<TierGate feature>` / `<TierField feature locked>`（FE-03）

## 前端（project-shell）

- [ ] `pages/NovelLayout.tsx`：`AuthGuard → LicenseProvider → ProjectShell → Outlet`（FE-04）
- [ ] `components/novel/license/ProjectShell.tsx`：按路由 id `GET /novels/{id}` 一次，Context 下发 `{project, loading, error}`（FE-04）
- [ ] `hooks/useProject.ts`：读 ProjectShell 上下文，未包返回安全默认值（FE-04）

## 测试（TE-15）

- [ ] `src/__tests__/features.test.ts`：`isFeatureEnabled` 两态矩阵（12 键）
- [ ] `src/__tests__/FeatureTier.test.tsx`：TierGate free 不渲染 / pro 渲染；TierField free 锁标 + 禁用
- [ ] `src/__tests__/LicenseProvider.test.tsx`：mock `/auth/verify`，断言仅 1 次 + 降级 free 不抛

## 验收

- [ ] `cd client/frontend && npx tsc --noEmit` 通过
- [ ] `cd client/frontend && npx vitest run` 新增单测绿
- [ ] `/novel/:id` 任意后代 `useTier()` 可取 `{tier,isFree,isPro}`；`/auth/verify` 仅 1 次
