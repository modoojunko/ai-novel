# TODO - 2026-07-28 跟进

## ✅ 已解决

### 1. S端 OAuth 授权后 C端 创建 API Key 失败 (500) ✅
- **根因**: JWT sub（用户名）不在 C端 `users` 表中
- **修复**: 中间件 `get_current_user()` 在验证 JWT 后自动创建用户
- 验证结果: `POST /api/v1/api-configs` → **HTTP 201 Created** ✅

### 2. api_configs.user_id FK 约束 ✅
- **方案**: C端 中间件将 S端 JWT 的 `sub` 作为 `users.id`，不存在则创建
- C端 `users.id` 现在是 S端 用户名（如 "done"）

### 3. `env.js` 404 ✅
- 已创建 `client/frontend/public/env.js`

## P1: 待验证

### 4. 前端 401/503 处理
- `api.ts` 已添加 401 → clear token → redirect `/login`
- `api.ts` 已添加 503 → redirect `/config`
- 需要浏览器硬刷新后验证

## P2: 代码清理

### 5. 测试问题
- 测试使用 `app.dependency_overrides` 绕过认证
- 已有 `TestRealJwtAuth` 类但被安全限制阻止运行
- 需要确认测试是否仍然通过

### 6. 部署启动文档
- 启动 C端 需要 `SERVER_API_BASE` 环境变量
- 需要准确的启动命令文档
