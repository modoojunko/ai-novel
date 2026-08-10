# 前端登录态自愈（009-frontend-auth-heal）

## Why

本地运行排查发现：C端 后端登录凭证持久化在 `client/backend/data/config.json`（token 由 S端 `device_grants` 表授权签发，磁盘持久、重启不丢），但**前端登录态只存在浏览器 `localStorage.auth_token`**，两者一旦脱钩就出现「后端 token 有效、前端却要求重新登录」：

- **切换运行栈**：docker 栈的 config.json（`.docker-data/client/`）与本地栈（`client/backend/data/`）是**两套不同的 token**。在 docker 栈登录过 → localStorage 存的是 docker 的 token → 切本地栈，后端比对本地 config.json 的 token → 401 → 前端清 token 并跳登录。
- **浏览器清空 localStorage**（无痕 / 关闭时清除 / 换端口导致 origin 变化）：后端 token 仍在磁盘，前端副本没了。
- **手动退出**后（`manual_logout`）跳过自动登录。

现状 `LoginPage` 已有静默检测（`GET /auth/check-auth` → 后端返回有效 token → 写回 localStorage），但它**只在 `/login` 路由挂载时执行**。用户落到其他路由（如直接进 `/novels`）时不会触发，登录态无法自愈。

## What Changes

新增启动级自愈钩子，把 `LoginPage` 的静默检测提升为**应用启动即执行**：

1. `hooks/useAuthHeal.ts`：`useEffect` 挂载时调 `request('/auth/check-auth')`；若 `code===0` 且 token 有效且非 `dev-token`，则写回 `localStorage`（`auth_token` + `auth_username`）。后端无效/不可达则静默失败，不打断当前页面（由 `LoginPage` 手动登录兜底）。
2. `components/ClientShell.tsx`：应用顶层调用 `useAuthHeal()`，使自愈覆盖所有路由。

不修改后端、不改变 `LoginPage` 现有手动登录流程。自愈是**幂等**的：后端 token 有效才写回，无效不改动 localStorage。

## Impact

- 前端新增：`hooks/useAuthHeal.ts`。
- 前端修改：`components/ClientShell.tsx`（调用钩子）。
- 测试：新增 `__tests__/useAuthHeal.test.tsx`（有效 token 写回 / 无效不清除 / 网络失败静默）。
- 不动后端、不动登录页。

## Rollout

1. 实现 `useAuthHeal` + 接入 `ClientShell`
2. 补 vitest 单测（写回 / 不清除 / 静默失败）
3. 前端回归：`tsc --noEmit` + `vitest run` + `npm run build`
4. `openspec validate 009-frontend-auth-heal --type change`
