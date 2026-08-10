# 009-frontend-auth-heal — Design

## 架构总览

```
应用启动 (ClientShell)
    └─ useAuthHeal()  [一次]
         └─ GET /auth/check-auth
              ├─ code=0 + token 有效 → 写回 localStorage(auth_token, auth_username)
              └─ code≠0 / 网络失败 → 静默，不改 localStorage，不跳转
```

## 关键实现点

### 1. hooks/useAuthHeal.ts

```ts
import { useEffect } from "react";
import { request } from "@/lib/api";
import { setToken } from "@/lib/auth";

export function useAuthHeal() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await request("/auth/check-auth");
        if (cancelled) return;
        if (res.code === 0 && res.data?.token && res.data.token !== "dev-token") {
          setToken(res.data.token, res.data.username ?? "");
        }
      } catch {
        // 后端不可达/未登录：静默失败，登录页兜底
      }
    })();
    return () => { cancelled = true; };
  }, []);
}
```

- 复用 `LoginPage` 已认证的判定条件（`code===0 && token && token!=='dev-token'`），保证两处行为一致。
- 幂等：后端有效才写回，无效不改动。
- `setToken` 复用 `lib/auth.ts`（同时写 `auth_token` + `auth_username`）。

### 2. components/ClientShell.tsx

在组件体内调用 `useAuthHeal()`，使自愈覆盖所有路由（`ClientShell` 包在 `<Navbar/>` 与 `<Routes/>` 外层）。

## 退役/删除

- 无。`LoginPage` 的静默检测保留（`/login` 直达场景仍需要）。

## 测试

- 见 spec.md ADDED Requirements（有效会话写回 / 未登录不清除 / 网络失败静默）。

## 风险与取舍

- **不强制跳转**：自愈只同步 localStorage，不改变当前路由；未登录用户仍落在原页面，由 Navbar「登录」按钮或 `LoginPage` 手动流程接管。
- **幂等、无循环**：自愈不调用 `/auth/verify`（那会刷新 `last_login_at`），只调用只读的 `check-auth`。
- **不影响手动退出**：`manual_logout` 场景下 `check-auth` 若仍返回有效 token 会重新写回——但这是「后端确实有效」的正向恢复，与用户预期一致。
