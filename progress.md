# 开发进度 — AI Novel C/S 架构重构

记录日期：2026-07-20

## 分支

`feat/cs-architecture-rebuild` — C/S 架构主分支

## 已完成

### C 端
- [x] FastAPI 后端改为 SQLite 本地数据库
- [x] 移除 SaaS 模块（auth/billing/admin）
- [x] auth_local 模块（浏览器 OAuth 登录 + 30 天会话）
- [x] AI Client 运行时动态 API Key
- [x] 前端 5 个新页面（登录/API 配置/密码重置）
- [x] PyInstaller onedir 打包 + Inno Setup 安装包
- [x] 启动加载动画 + 自适应分辨率
- [x] 自签名证书 + SmartScreen 绕过
- [x] **OAuth 登录修复**: S端地址从 config.json 读取，解决 env var 不传递问题

### S 端
- [x] FastAPI + Jinja2 模板渲染
- [x] 蓝白清爽主题 + 微动效
- [x] Landing page / 登录 / 注册 / 我的账号
- [x] 套餐管理 / 激活码 / 设备管理 / 账号信息（折叠式）
- [x] Cookie 认证 + Token 7 天过期
- [x] 删除旧静态 HTML，统一 Jinja2
- [x] CSS 缓存控制（Cache-Control + 版本号）
- [x] 55 个 E2E 测试全部通过（21/21 API）

### CI/CD
- [x] GitHub Actions 自动构建安装包（打 tag 触发）
- [x] 版本号从 git tag 自动获取

## 待完成

- [ ] S端 部署到 CloudBase
- [ ] 购买代码签名证书
- [ ] 自动更新机制

## 本地启动

```bash
# S端
python server/local_server.py

# C端（不设 SERVER_API_BASE，从 config.json 读）
cd client/backend && DATA_ROOT=./data uvicorn main:app --reload --port 8000
# → 需在 data/config.json 加 "server_api": "http://127.0.0.1:19000/api"

# C端 前端热更新
cd client/frontend && npm run dev

# 测试
python -m pytest server/tests/ -v
```
