## 1. 数据源与组件

- [x] 1.1 新建 `server/frontend/src/constants/site-beian.ts`：读取 `VITE_BEIAN_ICP` / `VITE_BEIAN_POLICE` / `VITE_BEIAN_POLICE_LINK`，推导公安查询链接（默认按编号数字拼 `beian.mps.gov.cn/#/query/webSearch?code=`），导出 `siteBeian`、`hasBeianInfo`；两段皆空时 `hasBeianInfo === false`。验证：类型检查过 + probe 缺号世界（dist 无号码字符串）。
- [x] 1.2 新建 `server/frontend/src/components/site/SiteBeianBar.vue`：ICP 段 `<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">`，公安段可条件渲染并带独立链接；两段皆空渲染空根节点；样式沿用 `.foot-cr` 字级。验证：e2e 断言上述 href 与 rel 属性存在。

## 2. 五个挂载点

- [x] 2.1 `FooterSection.vue`：在 `.foot-cr` 版权行之后插入 `<SiteBeianBar />`。验证：e2e 首页匹配数=1 且版权行下可见。
- [x] 2.2 `PublicLayout.vue`：新增 `isLanding` computed，非 landing 路由（login/register）在 `<main>` 之后渲染条，landing 跳过防同屏双份。验证：e2e 登录页可见条。
- [x] 2.3 `AuthLayout.vue`（/auth 过渡页）：外包纵向 flex 壳接管 100dvh，原居中区弹性伸缩，条吸底。验证：e2e /auth 页底部可见条。
- [x] 2.4 `NotFoundPage.vue`：同 2.3 处理其自带容器。验证：e2e 404 路径底部可见条。
- [x] 2.5 `DashboardLayout.vue`：内容流尾部追加条。验证：e2e 登录后 dashboard 页底可见。

## 3. 测试与构建探针

- [x] 3.1 `playwright.config.ts` webServer 注入测试号 `VITE_BEIAN_ICP=粤ICP备TEST0000001号`；新增 `e2e/tests/beian.spec.ts` 覆盖五个挂点 + 首页计数=1。验证：本地全量 e2e 绿且无 5173 串台。
- [x] 3.2 新建 `scripts/probe-beian.mjs` + npm script `probe:beian`：配置了号码→dist 必含该号码与 miit 链接（缺失 exit 1）；未配置→输出醒目 ⚠️ 告警放行。验证：本地「带号构建」与「空号构建」各跑一次得到断言/告警两种结果。
- [x] 3.3 `.env.production` 与 `.env.development` 追加三个变量的**空占位**注释行（值不入仓库），`env.d.ts` 补 ImportMetaEnv 声明。验证：typecheck 过且 grep 全仓库无真实号码字面量。
- [x] 3.4 本地质量门：`npm run build`（vue-tsc）+ 全量 Playwright。验证：全绿后再提 PR。

## 4. CI 接线与上线清单（运维）

- [x] 4.1 `s-server-deploy.yml` 构建行内联注入 `${{ secrets.VITE_BEIAN_ICP }}` 等三变量并接 `probe:beian`；`server-frontend-ci.yml` 加 probe（无 secret 时仅告警）。验证：PR CI 绿；部署 yaml 语法检查过。
- [ ] 4.2 前置探测 www 子域：`dig www.awesomenovel.com` + 探活响应体是否含站点与备案号；若未解析则按现托管类型补 DNS CNAME 或 CloudBase 自定义域名绑定。验证：www 与 apex 都能打开含备案号的站点。
- [ ] 4.3 建 GitHub Secrets（`VITE_BEIAN_ICP` 必填，公安两项可选）→ 合入 main 自动部署 → 线上 apex/www 探活复查响应体含真实号码与 `beian.miit.gov.cn`。验证：线上 curl 响应体核对。

## 5. 收尾

- [ ] 5.1 全部任务完成后走 `/opsx:archive` 归档本 change 并同步 spec。验证：`openspec validate --strict` 绿，`openspec/specs/site-beian/spec.md` 落库。
