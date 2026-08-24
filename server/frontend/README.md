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
| UI | Tailwind CSS 4（布局工具）+ 自建设计系统 `src/design/*.css` |
| HTTP | axios |
| 图标 | 内联 SVG 路径注册表（`src/components/ui/icons.ts`） |
| 测试 | Playwright |
| 语言 | TypeScript (strict) |

## 设计体系（换装 v2，对齐 Open Design 原型 = C端 终态）

- **配色**：冷调中性底 + 单一墨绿 accent，全部 oklch token + `color-mix` 派生（`src/design/base.css`），禁裸 hex/rgb
- **字体**：宋体展示栈（`--font-display`）+ 系统黑体正文 + 等宽数字 `.num`，无 webfont
- **组件类**：btn 族 / `.b` 徽标 / panel / field+input / scrim+mcard 弹窗 / appbar / stat-tiles / strip 消息条等，落在 `design/base.css`（通用）与 `design/landing.css`（营销页）、`design/dashboard.css`（控制台）
- daisyUI 与暗色主题已退役（换装 PR #191–#195）；图标统一走 `icons.ts` 注册表，禁 lucide/emoji
- **词汇守护**：`npm run design:lint`——档位外 opacity / 未登记任意值 / 原生色板 / 裸色值 / emoji / daisyUI 类回归即失败；白名单在 `scripts/design-vocab.mjs`（严格范围 = 全部 src）

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

# 终端 2: 启动前端开发服务器 (端口 5175，避开 C端前端的 5173)
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

# 设计词汇 lint（详见「设计体系」节）
npm run design:lint

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
│   ├── design/         设计系统 CSS（base / landing / dashboard）
│   ├── views/          页面组件 (9 个)
│   ├── components/     可复用组件 (21 个，含 ui/ 图标注册表与包装层)
│   └── composables/    组合式函数
├── scripts/            design-lint / design-vocab（词汇守护）
├── e2e/                Playwright E2E 测试
│   ├── fixtures.ts     测试 fixture
│   ├── mocks/          API Mock 层
│   └── tests/          测试用例 (9 个 spec)
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
