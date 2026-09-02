## Context

收银台实现（CashierPage.vue）只搬了原型的要点摘要与勾选框，原型第 396-398 行的全文入口（「全文」链接行 + 勾选行可点书名号 + paneDoc 弹窗内阅读视图）未实现。法律四件套已是正式静态页（`server/frontend/public/legal/*.html`，v2026.08），且备案条组件 `SiteBeianBar` 已在全站四个布局复用，唯独 /pay 独立布局没有挂。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**
- 勾选前即可从协议弹窗打开两份全文（新标签），支付状态不丢
- 文书名与真实文档一一对应（《购买协议》→《付费须知》，用户拍板）
- 版本号单源化（接口 `agreement_version`，前端不硬编码）
- /pay 页底补备案条兜底；e2e 断言防回归

**Non-Goals:**
- 不复刻原型 paneDoc 弹窗内阅读视图（见决策一）
- 不动后端、不动支付状态机、不动 skus 接口契约
- OrdersPage「见退款政策」纯文本维持不动：dashboard 布局页底已有备案条兜底，纯文本陈述无链接误导（评审拍板）
- RegisterPage 只补缺失的 `target` 属性，不改其法律链接既有口径

## Decisions

1. **真链接 + `target="_blank"`，不做弹窗内嵌全文视图**。原型 paneDoc 需要把全文抄进 SPA——正式文本改版时就是第二事实源（改协议必须两处同改，必然漂移）；且 AppModal 不支持嵌套 pane，要改造组件。新标签打开时 Vue 页面不卸载，弹窗/勾选/已选套餐状态全保留；RegisterPage:139-141 已有同款先例。备选（iframe 引静态页进弹窗）被否：iframe 高度/滚动与 AppModal 两段式动画耦合，收益不成比例。
2. **版本号从 `skusData.agreement_version` 条件渲染**：接口有值显示 `（v2026.08）`，为空不显示版本段而不是显示占位假版本。`payments.py:94` 是唯一事实源。
3. **勾选行 `<a>` 加 `@click.stop`**：链接嵌在 `<label>` 内，防御性阻断 click 冒泡转发给 checkbox（原型 JS 对 data-doc 按钮同样做了 `stopPropagation`），保证点链接绝不误切勾选态，e2e 也因此可断言「点链接后 checkbox 不变」。
4. **备案条直接挂 `.pay-page` 末尾，不改路由布局**：`.pay-page` 已是 `min-height:100vh` 纵向 flex，备案条 `margin-top:auto` 即可贴底，不需要为一条页脚把 /pay 套进 PublicLayout（收银台无控制台外壳是既定设计）。
5. **设计事实源同批对齐并清理死设计**：cashier.html 内《购买协议》标签与弹窗标题同批改名；data-doc 按钮改真 `<a target="_blank">` 链接；已否决的 paneDoc 阅读视图、示例全文模板与对应 JS 从原型删除——原型是 S端实现的设计事实源，保留死设计会诱导未来「向原型对齐」复活已否决的方案。
6. **弹窗标题「确认购买协议」改「确认购买」**（评审 P1）：原标题引用不存在的文书名，与 spec「无幽灵文档名」直接冲突，且任务清单的 grep 验证门会自相矛盾；备选（保留标题、放宽 spec 措辞）被否——文书名口径从严，改词零成本。
7. **退款页尾链并入本 change**（评审 P2，用户拍板）：RefundPage「看看退款政策全文」href 为 `/support` 且客服页没有退款政策出口，文案与去处不符，与主诉同类缺陷；一行修正 + s-pay-account-views 补一条 ADDED requirement。备选（记 follow-up change）被否：同一用户痛点拆两个 change 徒增流程。
8. **注册页两链接补 `target="_blank"`**（评审 P3，用户拍板顺带）：与同组《用户服务协议》《隐私政策》对齐，防整页跳走丢半填表单；存量缺陷顺带修，不单独立卷。

## Risks / Trade-offs

- [用户点开全文后跳走不回来] → 订单此时尚未创建、无扣款，回退路径零成本；`target="_blank"` 原页不丢状态。
- [e2e 全 mock 环境点真链接会导航到不存在路由] → 断言只验 href/target/可见性，不触发导航；`/legal/*.html` 在 vite dev 下由 public 目录真实存在，不构成阻塞。
- [改名《付费须知》影响已发文案口径] → 「购买协议」字样仅存在于收银台两处 + 原型一处，无历史订单/邮件引用，改名无存量兼容问题。

## Migration Plan

纯前端视图改动：合并进 main 后 CI 自动部署（novel-s-web-xxx），部署即生效；回滚 = revert 对应提交重部署。无数据迁移。
