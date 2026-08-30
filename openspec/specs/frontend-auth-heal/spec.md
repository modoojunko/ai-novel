# frontend-auth-heal Specification

## Purpose
TBD - created by archiving change 009-frontend-auth-heal. Update Purpose after archive.

## Requirements

### Requirement: 应用启动自愈本地登录态

- The system SHALL provide a `useAuthHeal` hook that on mount issues a single `GET /auth/check-auth` request.
- When the response has `code === 0` and a non-empty token that is not `"dev-token"`, the hook SHALL write the returned token and username into `localStorage` (`auth_token`, `auth_username`).
- When the response indicates not logged in, or the request fails, the hook SHALL NOT clear or modify existing `localStorage` state and SHALL NOT throw or navigate.
- The hook SHALL be invoked once from the application shell (`ClientShell`) so it covers every route, not just `/login`.

#### Scenario: valid backend session heals frontend token
- Given `localStorage` has no `auth_token`, and `GET /auth/check-auth` returns `code: 0` with a valid token and username
- When `useAuthHeal` mounts
- Then `localStorage.auth_token` equals the returned token and `localStorage.auth_username` equals the returned username

#### Scenario: backend not logged in leaves frontend untouched
- Given `localStorage` already has some `auth_token`
- When `GET /auth/check-auth` returns `code: 1` (not logged in) and the hook mounts
- Then the existing `localStorage.auth_token` is unchanged

#### Scenario: network failure is silent
- Given `GET /auth/check-auth` rejects with a network error
- When `useAuthHeal` mounts
- Then no error escapes to the app and `localStorage` is unchanged

### Requirement: 认证失效时清理本地登录态并回到登录页

C 端在收到认证失效响应（会话过期、账号已注销等导致的服务端拒绝）时，SHALL 清空本地持久化的登录凭据（config.json 中的 JWT 与用户名）并导航回登录页；本地作品数据 MUST 原样保留，且失效处理 MUST NOT 触发循环请求或静默吞掉用户当前操作上下文——回到登录页时应能重新登录并恢复使用。

#### Scenario: 注销导致的会话失效回到登录页

- **WHEN** 用户账号已在服务端完成注销，客户端携带原 JWT 发起请求并收到认证失效响应
- **THEN** 客户端清空 config.json 中的 JWT 与用户名，导航回登录页，本地作品数据不受影响

#### Scenario: 失效后重新登录恢复正常使用

- **WHEN** 会话失效处理完成、客户端回到登录页后，用户以有效账号重新登录
- **THEN** 客户端写入新凭据并正常进入工作台，不残留失效会话导致的异常状态
