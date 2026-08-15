# S端 前端 — License 管理门户

Vue 3 SPA，提供用户注册/登录、设备管理、License 激活等自助服务页面。
独立部署到 CloudBase 静态托管（`s-server-deploy.yml`，`tcb app deploy novel-s-web`），不再由后端静态挂载。

## 包管理器：只用 npm

CI（`server-frontend-ci.yml`、`s-server-deploy.yml`、`docker-build-ci.yml`）全部基于 `npm ci` 与 `package-lock.json`。
仓库内曾有 pnpm 残留文件（`pnpm-lock.yaml` / `pnpm-workspace.yaml`），已删除——**不要混用包管理器，避免两套 lock 文件并存**。

## 技术栈

| 项 | 选型 |
|----|------|
| 框架 | Vue 3 (Composition API + `<script setup>`) |
| 构建 | Vite 6 |
| 路由 | Vue Router 4 (History mode) |
| 状态管理 | Pinia |
| UI | daisyUI 5 (Tailwind CSS 4) |
| HTTP | axios |
| 图标 | lucide-vue-next |
| 测试 | Playwright |
| 语言 | TypeScript (strict) |

## 双主题

| 主题 | 色值 | 氛围 |
|------|------|------|
| `parchment`（默认） | 暖白 `#fdf8f3` | 书房白天的日光 |
| `novelforge` | 暖暗 `#14100b` | 深夜书房琥珀台灯 |

选择持久化在 `localStorage('theme')`；`index.html` 内联脚本会在 CSS 应用前写入 `data-theme`，避免深色用户刷新时闪白。

## API 地址配置

- 开发环境：`.env.development` → `VITE_API_BASE=/api`，由 Vite dev proxy 转发到本地后端（127.0.0.1:19000）。
- 生产环境：`.env.production` **硬编码**了 CloudBase 云端地址（`https://novel-s-server-…sh.run.tcloudbase.com/api`）。
  背景：CI 里用环境变量注入 `VITE_API_BASE` 曾失效，导致注册/登录全部打向静态托管的 `/api`（PR #146 已修复）。
  这是有意为之的兜底，改动部署域名时需同步更新该文件并保持与 `s-server-deploy.yml` 一致。

## 开发

```bash
cd server/frontend
npm install

# 终端 1: 启动 S端 后端 (端口 19000)
cd server && python app/main.py

# 终端 2: 启动前端开发服务器 (端口 5173)
cd server/frontend && npm run dev
```

Vite 自动代理 `/api/*` 到 `http://127.0.0.1:19000`，开发时无需 CORS 配置。

## 构建

```bash
npm run build
# 产物输出到 dist/；推送 main 后由 CI 自动部署到 CloudBase 静态托管
```

## 测试

```bash
# 类型检查
npx vue-tsc --noEmit

# E2E 测试（自动启动 dev server）
npx playwright test

# 运行单个测试文件
npx playwright test e2e/tests/auth.spec.ts
```

## 目录结构

```
server/frontend/
├── src/
│   ├── api/            axios 封装 + 拦截器
│   ├── stores/         Pinia (toast/session/devices)
│   ├── router/         路由表 + 双向守卫
│   ├── layouts/        PublicLayout / AuthLayout / DashboardLayout
│   ├── views/          页面组件 (8 个)
│   ├── components/     可复用组件 (16 个)
│   └── composables/    组合式函数
├── e2e/                Playwright E2E 测试
│   ├── fixtures.ts     测试 fixture
│   ├── mocks/          API Mock 层
│   └── tests/          测试用例 (82 个)
└── dist/               构建产物 (gitignore)
```

## 路由表

| 路径 | 页面 | 守卫 |
|------|------|------|
| `/` | Landing 首页 | 公开 |
| `/login` | 登录 | guestOnly |
| `/register` | 注册 | guestOnly |
| `/auth` | OAuth 设备授权 | 公开 |
| `/dashboard` | 控制台首页 | requiresAuth |
| `/dashboard/license` | License 管理 | requiresAuth |
| `/dashboard/devices` | 设备管理 | requiresAuth |
| `/dashboard/account` | 账户设置 | requiresAuth |
| `*` | 404 兜底 | 公开 |
