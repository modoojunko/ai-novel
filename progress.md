# 开发进度 — AI Novel C/S 架构重构

记录日期：2026-07-16

## 分支

`feat/cs-architecture-rebuild` — C/S 架构主分支（已合并到 main）
`feat/tauri-desktop` — Tauri 实验分支（已暂停）

## 已完成

### C 端（桌面应用）
- [x] FastAPI 后端改为 SQLite 本地数据库
- [x] 移除 SaaS 模块（auth/billing/admin）
- [x] auth_local 模块（浏览器 OAuth 登录 + 30 天会话）
- [x] AI Client 运行时动态 API Key
- [x] 前端 5 个新页面（登录/API 配置/密码重置）
- [x] PyInstaller onedir 打包 + Inno Setup 安装包
- [x] 启动加载动画 + 自适应分辨率
- [x] 自签名证书 + SmartScreen 绕过

### S 端（本地测试服务器）
- [x] FastAPI + Jinja2 模板渲染
- [x] 蓝白清爽主题设计
- [x] Landing page / 登录 / 注册 / 我的账号
- [x] 套餐管理 / 激活码 / 设备管理 / 账号信息
- [x] 账号信息页折叠式设计（点击修改才展开）
- [x] 空状态引导提示（设备/套餐）
- [x] Cookie 认证 + Token 7 天过期
- [x] 激活成功后自动刷新显示最新套餐
- [x] 浏览器 OAuth 授权流程
- [x] 9 个云函数代码（待部署 CloudBase）
- [x] 55 个 E2E 测试全部通过（21/21 API 全覆盖）

### 代码质量
- [x] Ruff lint 零错误 + format 通过
- [x] CI: Backend CI / Frontend CI / CodeQL 全部通过
- [x] PR #6 已合并到 main
- [x] S端 密码安全：pbkdf2 哈希
- [x] Token 安全：Cookie 存储 + 7 天过期 + 自动清理

## 待完成

### S 端（云部署）
- [ ] 部署到腾讯云 CloudBase
- [ ] HTTPS + 域名

### C 端（上线前）
- [ ] 购买代码签名证书（DigiCert ~$200-500/年）
- [ ] S 端地址可配置（首次启动引导配置）
- [ ] 自动更新机制

### 安全
- [ ] 生产环境 CORS 限制
- [ ] 密码哈希升级为 bcrypt
- [ ] API 速率限制

## 本地启动方式

```bash
# S端
python server/local_server.py
# 访问 http://127.0.0.1:19000

# C端（开发模式，无 License）
cd client/backend && DEV_MODE=1 DATA_ROOT=./data uvicorn main:app --reload --port 8000

# 测试
python -m pytest server/tests/ -v
```
