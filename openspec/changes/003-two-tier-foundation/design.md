# 前端两态地基 — Design

> 纯前端 change。新增 2 个 capability：`tier-gating`（LicenseProvider/useTier/features/FeatureTier）+ `project-shell`（NovelLayout 挂载/useProject/ProjectShell）。

## 核心文件

### 新增 `src/lib/features.ts`（FE-02）

```ts
export type FeatureKey =
  | "tree-crud" | "prose-edit" | "version-history" | "archive"
  | "volume-chapter-config" | "advanced-config-entry" | "settings-7-items"
  | "settings-ai-fields" | "outline-advanced-fields" | "ai-generate"
  | "prompt-panel" | "ai-model";

export const FEATURES: Record<FeatureKey, { free: boolean }> = {
  // 免费 ✅：完整人工写作能力
  "tree-crud": { free: true },
  "prose-edit": { free: true },
  "version-history": { free: true },
  "archive": { free: true },
  "volume-chapter-config": { free: true },
  "advanced-config-entry": { free: true },
  "settings-7-items": { free: true },
  // 免费 🔒：AI 属 PRO
  "settings-ai-fields": { free: false },
  "outline-advanced-fields": { free: false },
  "ai-generate": { free: false },
  "prompt-panel": { free: false },
  "ai-model": { free: false },
};

/** 纯函数，无 DOM 依赖。免费键恒 true；锁键仅付费（tier !== "none"）为 true。 */
export function isFeatureEnabled(key: FeatureKey, tier: string): boolean {
  return FEATURES[key].free || tier !== "none";
}
```

要点：运营判定（免费限 1 本、试用横幅、gate 警告）**不进**清单，保留直判；清单只管功能显隐（C1/N14）。

### 新增 `src/components/novel/license/LicenseProvider.tsx`（FE-01）

```tsx
import { createContext, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface TierState {
  tier: string;
  isFree: boolean;
  isPro: boolean;
  trialRemainingDays: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface VerifyResponse {
  tier?: string;
  trial_remaining_days?: number;
}

// module 级缓存：同会话多 Provider/重挂载不重复请求（/auth/verify 仅 1 次）。
let cachedVerify: VerifyResponse | null = null;

const TierContext = createContext<TierState | null>(null);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState(cachedVerify?.tier ?? "none");
  const [trialRemainingDays, setTrialRemainingDays] = useState(cachedVerify?.trial_remaining_days ?? 0);
  const [loading, setLoading] = useState(!cachedVerify);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (useCache: boolean) => {
    if (useCache && cachedVerify) {
      setTier(cachedVerify.tier ?? "none");
      setTrialRemainingDays(cachedVerify.trial_remaining_days ?? 0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = (await api.post("/auth/verify")) as VerifyResponse;
      cachedVerify = r;
      setTier(r.tier ?? "none");
      setTrialRemainingDays(r.trial_remaining_days ?? 0);
      setError(null);
    } catch {
      cachedVerify = null; // 失败不缓存，允许重试
      setTier("none"); // 免费兜底，不抛 500
      setError("套餐校验失败，已按免费处理");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(true); }, [load]);

  const refetch = useCallback(() => { cachedVerify = null; void load(false); }, [load]);

  const isFree = tier === "none";
  const value: TierState = { tier, isFree, isPro: !isFree, trialRemainingDays, loading, error, refetch };
  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

export { TierContext };
```

### 新增 `src/hooks/useTier.ts`（FE-01）

```ts
import { useContext } from "react";
import { TierContext, TierState } from "@/components/novel/license/LicenseProvider";

const SAFE_FREE: TierState = {
  tier: "none", isFree: true, isPro: false, trialRemainingDays: 0,
  loading: false, error: null, refetch: () => {},
};

export function useTier(): TierState {
  return useContext(TierContext) ?? SAFE_FREE;
}
```

### 新增 `src/components/novel/license/FeatureTier.tsx`（FE-03）

```tsx
import type { ReactNode } from "react";
import { isFeatureEnabled, type FeatureKey } from "@/lib/features";
import { useTier } from "@/hooks/useTier";

/** 功能不可用 → 不渲染子树（AI 入口/按钮/整棵 AI 子树隐藏）。 */
export function TierGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { tier } = useTier();
  if (!isFeatureEnabled(feature, tier)) return null;
  return <>{children}</>;
}

/** 🔒 包装表单字段：禁用态显示锁标 +「属 PRO」，保留字段骨架。locked=false 时仅禁交互不显锁。 */
export function TierField({
  feature, locked = true, children,
}: { feature: FeatureKey; locked?: boolean; children: ReactNode }) {
  const { tier } = useTier();
  if (isFeatureEnabled(feature, tier)) return <>{children}</>;
  return (
    <div className="relative opacity-70 pointer-events-none select-none" data-feature-locked={feature}>
      {locked && (
        <span className="badge badge-sm badge-ghost absolute top-2 right-2 z-10">🔒 属 PRO</span>
      )}
      {children}
    </div>
  );
}
```

### 新增 `src/components/novel/license/ProjectShell.tsx` + `src/hooks/useProject.ts`（FE-04）

```tsx
// ProjectShell.tsx —— 项目 Context，按路由 id 一次 GET /novels/{id}
import { createContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";

export interface ProjectState {
  project: Record<string, any> | null;
  loading: boolean;
  error: string | null;
}

const ProjectContext = createContext<ProjectState | null>(null);

export function ProjectShell({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/novels/${id}`)
      .then((p) => { setProject(p); setError(null); })
      .catch(() => { setProject(null); setError("项目加载失败"); })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <ProjectContext.Provider value={{ project, loading, error }}>
      {children}
    </ProjectContext.Provider>
  );
}

export { ProjectContext };
```

```ts
// hooks/useProject.ts
import { useContext } from "react";
import { ProjectContext, ProjectState } from "@/components/novel/license/ProjectShell";

export function useProject(): ProjectState {
  return useContext(ProjectContext) ?? { project: null, loading: false, error: null };
}
```

注：003 阶段 ProjectShell 仅提供 Context；NovelPage 仍自持 fetch/skeleton（改在 004 工作台纵切收敛）。

### 修改 `src/pages/NovelLayout.tsx`（FE-04）

```tsx
import { Outlet } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import { LicenseProvider } from "@/components/novel/license/LicenseProvider";
import { ProjectShell } from "@/components/novel/license/ProjectShell";

export default function NovelLayout() {
  return (
    <AuthGuard>
      <LicenseProvider>
        <ProjectShell>
          <Outlet />
        </ProjectShell>
      </LicenseProvider>
    </AuthGuard>
  );
}
```

## 测试（TE-15，vitest）

- `src/__tests__/features.test.ts`：`isFeatureEnabled` 两态矩阵 —— 免费 7 键 none/pro 均 true；锁定 5 键 none=false / pro=true。
- `src/__tests__/FeatureTier.test.tsx`：`<TierGate feature="ai-generate">` free 不渲染 / pro 渲染；`<TierField feature="settings-ai-fields" locked>` free 显示锁标且不可交互。
- `src/__tests__/LicenseProvider.test.tsx`：mock `api.post("/auth/verify")` → 断言 mount 仅调 1 次、`useTier()` 下发 `{tier,isFree,isPro}`；reject 时降级 free 不抛。测试用 `vi.mock("@/lib/api")` + `renderHook`。

## 验收

- `cd client/frontend && npx tsc --noEmit` 通过
- `cd client/frontend && npx vitest run` 新增单测绿
- `/novel/:id` 任意后代 `useTier()` 可取 `{tier,isFree,isPro}`；network 面板 `/auth/verify` 仅 1 次

## 风险

- 缓存语义：module 级 `cachedVerify` 在 HMR/多 Provider 下的去重；失败不缓存允许重试。
- `useTier` 安全默认值：未包 Provider 返回免费态，避免 `context is undefined` 崩树。
- 不迁移 NovelPage/NovelListPage 现有 tier state（留 004 收敛），本 change 只新增 Provider + 挂载，零行为破坏。
