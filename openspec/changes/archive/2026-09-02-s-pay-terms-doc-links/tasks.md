## 1. 准备

- [x] 1.1 建 git worktree + feature 分支 `feat/s-pay-terms-doc-links`（每会话隔离规约），验证 `git branch --show-current` 输出新分支名

## 2. 设计事实源同步（cashier.html）

- [x] 2.1 《购买协议》→《付费须知》改名、mcard-head「确认购买协议」→「确认购买」、data-doc 按钮改真 `<a href="/legal/*.html" target="_blank">`、删除 paneDoc 块与两份示例全文模板及对应 JS；验证：`grep -c 购买协议` = 0 且 `grep -c "data-doc\|paneDoc"` = 0

## 3. 收银台与退款页实现

- [x] 3.1 协议弹窗：标题 `title="确认购买"`；勾选行书名号改真链接（`/legal/payment-notice.html`、`/legal/refund-policy.html`，`target="_blank" rel="noopener"`，加 `@click.stop` 防误触 checkbox），文案改《付费须知》；验证：打开弹窗标题与两链接渲染正确、点链接后勾选态不变
- [ ] 3.2 弹窗要点列表下补「全文」链接行：两文书名 + 版本号取 `skusData.agreement_version` 条件渲染（空则整段版本号不显示）；验证：mock 带版本显示 `（v2026.08）`、置空不显示版本段
- [ ] 3.3 选套餐态提示行（原 :301）同步改称《付费须知》；验证：CashierPage.vue 源文件「购买协议」字样 grep 为 0
- [ ] 3.4 `.pay-page` 末尾挂 `SiteBeianBar`（`margin-top:auto` 贴底，不动路由布局）；验证：选套餐态滚动页底可见四份法律文件链接与备案号
- [x] 3.5 RefundPage 尾部「看看退款政策全文」href 改 `/legal/refund-policy.html`（`target="_blank" rel="noopener"`，去掉 router.push）；验证：点开新标签直达文档、原退款页表单与预览状态不丢
- [x] 3.6 RegisterPage:140-141《付费须知》《退款政策》补 `target="_blank"`；验证：两链接属性正确（人工核对，属性级改动）

## 4. e2e 与门禁

- [x] 4.1 `cashier.spec.ts` 补断言：弹窗内 `a[href="/legal/payment-notice.html"][target="_blank"]` 与 `a[href="/legal/refund-policy.html"][target="_blank"]` 存在且可见（只验属性不触发导航）；`refund-flow.spec.ts` 补断言：尾链 `a[href="/legal/refund-policy.html"][target="_blank"]` 存在；验证：两个 spec 本地 playwright 全绿
- [x] 4.2 S端门禁全跑：`npm run design:lint` + `vue-tsc --noEmit` + cashier/refund 相关 e2e；验证：三项命令零红（design:lint 唯一红为 site-beian.ts 存量，worktree 与 main 逐字节一致双证；e2e 全量 142 过，唯一 fail=auth.spec 忘记密码 flake，单跑复绿）

## 5. 交付

- [x] 5.1 渲染截图对照存入 change 目录（S端 无 parity 基线，proposal Design Impact 承诺项）；验证：截图文件在 `openspec/changes/s-pay-terms-doc-links/` 下（shot-pay-pick / shot-pay-modal / shot-refund-tail / shot-register-legal 四张，临时 spec 跑完即删）
- [x] 5.2 分支提交并开 PR（base=main），CI 绿后合并自动部署；验证：PR #277 CI 全绿（Docker+S端前端 CI success），已合并 ac11e12，自动发布 novel-s-web success（run 33632375466），线上 /legal 两文档与 /pay 探活全 200
