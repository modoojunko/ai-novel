# 口径核对记录（task 6.1）

对照对象：`server/frontend/src/constants/support.ts` + `SupportPage.vue` 渲染文案 ↔ docs/legal 四件套 v2026.08。

| 项 | 协议出处 | 协议原文 | 实现值/文案 | 一致 |
|---|---|---|---|---|
| 客服邮箱 | 用户服务协议 §一.3/§三.4；付费须知 §十一.1；隐私政策 §四/§六 | alexee_zhu@163.com | `SUPPORT_EMAIL` 同值；mailto 收件人同源 | ✓ |
| 一般回复时限 | 付费须知 §十一.1「一般在 48 小时内回复」；退款政策 §8 异议 48h；服务协议 §七.2 处置申诉 48h | 48 小时 | `SUPPORT_REPLY_HOURS=48`；提示条「一般问题我们会在 48 小时内回复」；退款卡「48 小时内答复」 | ✓ |
| 个保权利响应 | 隐私政策 §四「15 个工作日内响应」 | 15 个工作日 | `PRIVACY_RESPONSE_WORKDAYS=15`；提示条与个保卡同口径 | ✓ |
| 注销办理时限 | 用户服务协议 §三.4「15 个工作日内完成处理；未消耗套餐按《退款政策》办理退款」 | 15 个工作日 | `ACCOUNT_DELETION_WORKDAYS=15`；注销卡逐字对齐（含未消耗套餐句） | ✓ |
| 发票时限 | 付费须知 §八.1「一般 3 个工作日内出具（电子普通发票）」 | 3 个工作日 | `INVOICE_WORKDAYS=3`；发票卡「发票一般在 3 个工作日内开具」、desc 提电子普通发票 | ✓ |

双口径澄清（隐私政策遗留事项 #3）：48 小时=一般客服，15 个工作日=个保权利/注销，页面分卡表述未混用。

范围外提示：`docs/design-s/prototypes/account-deletion.html` 有 3 处「联系客服」死链，属 account-deletion change（OPEN）的资产，本 change 未动，落地时应同样指向 `/support`。
