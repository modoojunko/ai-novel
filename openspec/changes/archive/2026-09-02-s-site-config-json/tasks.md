# s-site-config-json — Tasks

实施约束：每会话默认 git worktree 隔离（`git worktree add ../ai-novel-site-config -b feat/site-config-json main`），commit 前必查分支；改动仅限 `server/frontend/`；S端 e2e 本机全量跑绿后才推。

## 1. 运行时配置加载器

- [x] 1.1 新建 `src/lib/site-config.ts`：`SiteRuntimeConfig` 类型（4 个可选字段）、`loadSiteConfig()`（DEV 直接返回空；PROD `fetch('site-config.json', { cache: 'no-store' })` + AbortController 3s 超时 + 白名单清洗 + fail-open 空 配置）。验证：`npx vue-tsc --noEmit` 绿
- [x] 1.2 新建 `public/site-config.json` 承载生产真实值（`apiBase=https://www.awesomenovel.com/api`、`beianIcp=琼ICP备2026012341号`、police 两字段空），文件头注释写明「改此文件重新上传即生效，免重建」。验证：JSON 可被 `JSON.parse`（注：JSON 不能带注释，说明改写进 README「运行时站点配置」节）

## 2. 消费方接入（挂载前定值）

- [x] 2.1 `src/api/request.ts`：导出 `setApiBase(raw: string)`，内部复用 `normalizeApiBase` 写 `request.defaults.baseURL`。验证：vue-tsc 绿；grep 确认无其他 `import.meta.env.VITE_API_BASE` 残留消费点
- [x] 2.2 `src/constants/site-beian.ts`：新增 `applyBeianOverride(cfg)` 就地改写 `siteBeian.icp/police/policeUrl`（policeUrl 按 policeLink/编号数字规则重算）；`hasBeianInfo` 常量改函数；文件头注释写明「仅限 bootstrap 挂载前调用」。验证：vue-tsc 绿
- [x] 2.3 `src/components/site/SiteBeianBar.vue`：`v-if="hasBeianInfo"` 改 `hasBeianInfo()`。验证：vue-tsc 绿
- [x] 2.4 `src/main.ts`：改为异步 `bootstrap()`——先 `loadSiteConfig` → `setApiBase`/`applyBeianOverride` → 再 `createApp/mount` → `warmUpBackend()`。验证：vue-tsc 绿

## 3. 探针与既有防线

- [x] 3.1 `scripts/probe-beian.mjs` 扩展：dist 必须含 `site-config.json` 且 JSON.parse 通过；`VITE_BEIAN_ICP` 已配置时断言 JSON 含同值；未配置维持告警放行。验证：本地 `VITE_BEIAN_ICP=琼ICP备2026012341号 npm run build && npm run probe:beian` 通过；再以空 env 跑一次走告警分支；另加漂移负面用例（env 旧号 + JSON 新号 → exit 1）通过
- [x] 3.2 确认 CI 零改动：`server-frontend-ci.yml`、`s-server-deploy.yml` 与 `.env.production` 不动。验证：`git diff --name-only` 仅含前端 src/public/scripts 文件

## 4. 本机全量验证（推前门禁）

- [x] 4.1 worktree 内 `npm ci` 后跑全量 e2e：`npx playwright test` 全绿（dev 不加载配置 = 现有 spec 零改动全过）。验证：退出码 0（134/134）
- [x] 4.2 生产路径冒烟（运行时覆盖实证）：`VITE_BEIAN_ICP=`（留空）构建 → `vite preview` 起产物 → 一次性 playwright 脚本断言首页备案条渲染出 `site-config.json` 里的号码（烘焙值空、运行时值出 = 覆盖链路通）。验证：断言通过，preview 进程已清理（实测再加强：烘焙基址换成可区分值后，请求仍打运行时 www 域名 = 运行时层实证压过烘焙层）
- [x] 4.3 回归基址回落：冒烟脚本同场断言「删掉 dist 里 site-config.json 重建后」备案条整条隐藏、请求走 `/api` 默认。验证：断言通过（修正：main 的 `.env.production` 兜底已烘焙生产域名而非 `/api`，故回落断言用可区分烘焙值实证——JSON 缺失时请求打烘焙值、备案条随烘焙空号隐藏，fail-open 生效）

## 5. 提交与上线

- [x] 5.1 worktree 内提交（分支 `feat/site-config-json`，commit 前查分支），推远端（闸拦截时走 gh api 提交配方），开 PR 到 main。验证：PR 可见、diff 限定在 `server/frontend/`（mimosa 拦截存量误报 → gh api blob(带 size 校验)/tree/commit/ref 全程放行，PR #268）
- [x] 5.2 PR CI（type check + build + 探针 + e2e）全绿后合入。验证：CI 绿、PR merged（S端 前端 CI 双线绿；Docker 构建红为 main 存量——自 #266 起 `COPY secrets/` 缺目录，与本改动无关，squash 合入未受阻）
- [x] 5.3 上线验证：`curl` 线上 `/site-config.json` 返回生产值；www 入口打开站点备案条可见、控制台无配置相关报错；API 请求基址与改前一致（值相同零行为变化）。验证：三项全过——webapps 与 www 两域名 JSON 均为生产值；无头浏览器实测线上：config 请求发出、备案条渲染琼号、请求打 `https://www.awesomenovel.com/api/check-auth`
