# S端 前端 — License 管理门户

Vue 3 SPA，提供用户注册/登录、设备管理、License 激活等自助服务页面。编译后由后端 FastAPI 静态托管，**不独立部署**。

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
# 产物输出到 dist/，由后端 FastAPI 静态挂载
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
