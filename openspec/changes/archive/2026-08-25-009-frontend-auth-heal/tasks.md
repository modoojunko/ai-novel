# 009-frontend-auth-heal — Tasks

## FE-01 实现启动自愈钩子
- [x] `hooks/useAuthHeal.ts`：挂载时一次 `GET /auth/check-auth`，有效 token 写回 localStorage，无效/失败静默
- [x] `components/ClientShell.tsx`：应用顶层调用 `useAuthHeal()`

## FE-02 单测
- [x] `__tests__/useAuthHeal.test.tsx`：有效会话写回 / 未登录不清除 / dev-token 不写回 / 网络失败静默（4 passed）

## FE-03 回归
- [x] 前端 `tsc --noEmit` ✓
- [x] 前端 `vitest run` 全绿（48 passed，原 44 + 新 4）
- [x] 前端 `npm run build` ✓
- [x] `openspec validate 009-frontend-auth-heal --type change` → valid
