# Tasks

## 1. 单一事实源与路由

- [x] 1.1 新建 `server/frontend/src/constants/support.ts`：导出 `SUPPORT_EMAIL`（alexee_zhu@163.com）、`SUPPORT_REPLY_HOURS = 48`、`PRIVACY_RESPONSE_WORKDAYS = 15`；vue-tsc --noEmit 通过
- [x] 1.2 router 的 PublicLayout children 增加 `/support` 路由（name: support，无 guestOnly/requiresAuth）；`npm run build`（或 vue-tsc）通过，未登录直访不重定向（本地起服务手验）

## 2. 客服页实现

- [x] 2.1 新建 `server/frontend/src/views/SupportPage.vue`：邮箱区（mailto 锚点 + 纯文本 + 复制按钮）、六个场景分节（退款/发票/注销/安全/个保权利/一般问题，各列必带信息清单）、时限句由常量插值；文案遵循 §13（动词按钮、无内部术语、补救句带出口）
- [x] 2.2 视觉走既有语义类与 oklch 令牌（panel/排版类），不新增组件词汇；`npm run design:lint` 全绿（53 文件 0 违规）
- [x] 2.3 截图对照：未登录与已登录两种状态渲染 `/support`，截图存 change 目录 `screenshots/`，与 S端 现有公开页（登录页）风格同族自查

## 3. C端 原型先行

- [x] 3.1 `docs/design-c/prototypes/list.html`：appbar 已登录区「设置」按钮旁加「联系客服」ghost 链接（btn-ghost btn-sm 同规格，href 占位 `#`）；`book.html` 的 appbar-wb 同步同款；ADJUSTMENTS.md 登记本次新增（预期零偏差，原样落地）

## 4. C端 实现与门禁

- [x] 4.1 Navbar.tsx 两形态已登录区各加「联系客服」`<a>` 按钮：`target="_blank" rel="noreferrer"`，地址 = `fetchPortalUrl()` 去尾斜杠拼 `/support`，经 `isSafeExternalUrl` 校验；portal_url 为空时按钮不渲染；未登录区不加
- [x] 4.2 C端 门禁全绿：`npm run design:lint` → `npm run design:check`（books/empty/quota 3 场景 3 passed，含 appbar 按钮同步渲染）→ `tsc --noEmit` → vitest 110/110（Navbar/portal 消费方无回归）
- [x] 4.3 本地 docker 栈全量 e2e 跑通：60 passed / 0 failed / 12 skipped（存量跳过项）；design-parity.spec 的 `/api/auth/config` 桩补 portal_url 真值使按钮双侧同步
- [x] 4.4 `docker compose build` 重建本地容器，起应用人工核验：列表屏按钮 href=`https://www.awesomenovel.com/support`、target=_blank；portal_url 为空时按钮 count=0（验证脚本输出在会话记录，截图 `screenshots/c-list-support-btn.png`）

## 5. S端 入口与设计资产

- [x] 5.1 FooterSection.vue 链接组增加「联系客服」`router-link to="/support"`；落地页点击可达（验证：href=/support，点击后 url=/support、h1=联系客服），e2e 不回归
- [x] 5.2 支付五原型死链替换：cashier 3 处、order-detail 1 处、invoice 1 处、refund 1 处共 6 锚点改 `href="/support"`；grep 复核无 `#` 残留（orders.html 仅注释无锚点；order-detail ops 为演示 button 非锚点，留实现转正；account-deletion.html 属另一 change 资产未动）

## 6. 验证与收尾

- [x] 6.1 口径核对：客服页时限/邮箱与 docs/legal 四件套逐字一致，diff 记录见 change 目录 `caliber-check.md`
- [x] 6.2 S端 门禁全绿：`vue-tsc --noEmit` OK + `design:lint` 0 违规（53 文件）+ e2e 87 passed（35s）
