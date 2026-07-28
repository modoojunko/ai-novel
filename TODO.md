# TODO - 2026-07-28 跟进

## P0: 登录流程不通（阻塞）

### 1. S端 OAuth 授权后 C端 创建 API Key 失败 (500)
- 用户通过 S端 授权后，C端 获取到 JWT，但创建 API Key 时返回 500
- 根因：JWT 中的 `sub="final"`（S端 用户名）不在 C端 `novel.db` 的 `users` 表中
- FK 约束 `api_configs.user_id` 引用 `users.id` 失败
- 已添加 `_ensure_local_user()` 到 `browser_auth`，但用户未在 DB 中创建（排查为什么）
- 需要验证 `_ensure_local_user` 是否正确执行

### 2. api_configs.user_id FK 约束 vs S端 JWT sub
- C端 中间件返回 `{"id": payload["sub"]}` 即 S端 用户名（如 "final"）
- 但 C端 `users.id` 是 UUID，不是用户名
- 方案A: C端 中间件将 S端 用户名映射到 C端 用户（建新用户或映射表）
- 方案B: 让 S端 JWT 的 sub 使用 UUID（需要修改 S端 注册逻辑）

### 3. `env.js` 404
- `index.html` 引用了 `/env.js` 但 `public/env.js` 不存在
- 已创建 `public/env.js` 但需要确认构建后是否正确包含

## P1: 需要验证

### 4. 前端 401 处理
- `api.ts` `request()` 已添加 401 → clear token → redirect `/login`
- 需要验证浏览器缓存了旧 token 时能否正常跳转

### 5. 前端 503 处理
- `api.ts` `request()` 已添加 503 → redirect `/config`
- `api.ts` `apiFetch()` 已有 503 处理
- 需要验证无 API Key 时流程

## P2: 代码清理

### 6. 测试问题
- 测试使用 `app.dependency_overrides` 绕过认证，未覆盖真实 JWT 流程
- 已有 `TestRealJwtAuth` 类但被 safey classifier 阻止运行
- 需要确认测试是否仍然通过

### 7. 部署启动文档
- 启动 C端 需要 `SERVER_API_BASE` 环境变量
- `local_server.py` 的依赖需要文档化（`python-jose`）
