## Why

/pay 收银台要求用户勾选「我已阅读并同意《购买协议》与《退款政策》」才能支付，但整个购买流程没有任何一条路径能打开这两份文档全文：弹窗勾选行的书名号是纯文本（CashierPage.vue:387）、页面提示行的链接只开摘要弹窗（CashierPage.vue:301）、/pay 独立布局没有备案条页脚兜底。设计原型（docs/design-s/prototypes/cashier.html:396-398）本就画了全文入口，实现时丢失。这构成「未阅读即同意」的合规缺口，用户已线上实测点不到（2026-09-02 反馈）。评审（同日）另发现同类缺陷：退款页「看看退款政策全文」链接指向客服页而非文档本身。

## What Changes

- 协议确认弹窗：勾选行的《购买协议》《退款政策》由纯文本改为真链接，新标签打开 `/legal/payment-notice.html` 与 `/legal/refund-policy.html`（弹窗、二维码、轮询状态不丢，RegisterPage 同款写法）；要点列表下补「全文」链接行，版本号取接口 `GET /api/pay/skus` 已返回的 `agreement_version`（后端单源，前端不硬编码第二事实源）
- 弹窗标题「确认购买协议」改「确认购买」（评审拍板）：标题不得引用不存在的文书名
- 命名对齐（用户拍板）：《购买协议》改称《付费须知》——法律四件套里不存在「购买协议」这份文档，注册页与备案条用的都是《付费须知》真名
- /pay 页底部补全站统一备案条 `SiteBeianBar`（四份法律文件入口 + 备案号），补上独立布局缺失的兜底出口
- 退款页（RefundPage）尾部「看看退款政策全文」链接由 `/support` 修正为 `/legal/refund-policy.html` 新标签打开（评审拍板并入：与主诉同类缺陷，退款流程里退款政策同样不可直达）
- 注册页《付费须知》《退款政策》两链接补 `target="_blank"`（评审拍板顺带：防整页跳走丢弃填了一半的注册表单，与同组另两链接对齐）
- 设计事实源同步：docs/design-s/prototypes/cashier.html 文书名与弹窗标题同批改名；已否决的 paneDoc 弹窗内全文视图（含示例模板与 JS）从原型删除，data-doc 按钮改真链接
- e2e 补断言：cashier.spec.ts（弹窗全文链接）、refund-flow.spec.ts（退款页尾链）
- 不做：不复刻原型的弹窗内嵌全文阅读视图——全文已是正式静态页，SPA 内再抄一份即第二事实源；OrdersPage「见退款政策」纯文本维持不动（dashboard 页底备案条已兜底，评审拍板）

## Capabilities

### New Capabilities

- `s-pay-cashier`: 收银台购买流程的界面侧契约——选套餐页、协议确认弹窗（要点摘要 + 全文文档入口 + 勾选留痕）、协议文案与真实法律文档的对应关系。收银台此前无 spec 归属，本 change 首次立卷。

### Modified Capabilities

- `s-pay-account-views`: 退款页新增「退款政策全文直达入口」要求——尾链 SHALL 指向真实退款政策文档（新标签），MUST NOT 指向客服页。

## Impact

- 代码：`server/frontend/src/views/pay/CashierPage.vue`（弹窗标题/链接/提示行/页脚备案条）、`server/frontend/src/views/pay/RefundPage.vue`（尾链修正）、`server/frontend/src/views/RegisterPage.vue`（两处 target）；`docs/design-s/prototypes/cashier.html`（改名 + 删 paneDoc）；e2e `cashier.spec.ts`、`refund-flow.spec.ts`
- API：无变化（`agreement_version` 字段已存在于 skus 响应，payments.py:94）
- 后端：零改动，不触支付状态机
- 风险：低——纯前端视图层；备案条为既有组件复用

## Design Impact

- 受影响端：S端（server/frontend）
- 受影响屏/弹层：/pay 收银台页（提示行 + 协议确认弹窗 AppModal + 页底备案条）、退款页（尾部链接）、注册页（法律勾选区两链接属性）
- 对象状态：无新增对象状态；复用既有 AppModal 两段式 `.show` 进出场与 `.lnk` 链接样式；不新增 notice/pill/toast，语气词表不动（info/ok/warn/err 维持）
- 两端共享段：不触碰（不改 base.css 令牌与基础组件类，无双端同步义务）
- 原型先行：免——S端 cashier 原型已存在且本 change 是向原型对齐（全文入口原型已有）并清理已否决的 paneDoc 残留；免原型登记
- 设计工件：实现侧自查，渲染截图对照随 change 目录留存（S端 无 parity 门禁基线）
