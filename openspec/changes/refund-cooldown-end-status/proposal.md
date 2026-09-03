## Why

退款冷静期倒计时归零后、定时任务真正把退款提交微信之前（常态最长 10 分钟），订单详情页停留在「退款将在 0 分 00 秒后提交……冷静期内可取消恢复使用」并保留「取消退款」按钮——文案自相矛盾，点取消还会被后端以冷静期已过拒绝。2026-09-02 真实工单（S20260902-5C05747FD935AFDD）恰逢定时任务故障，该页面卡在此态 6 小时，用户无从得知退款是否已启动。退款页（RefundPage）对冷静期中的订单还会掉进「金额预览」分支，呈现可再次确认的误导入口。

## What Changes

- 订单详情页新增「冷静期已结束·退款已启动」过渡展示态（纯前端判定，后端零改动）：
  - 状态说明条改述为「退款流程已启动、不能再取消、将原路退回」口径；
  - 操作区移除「取消退款」按钮，提供「返回我的订单」出路；
  - 时间线「退款确认（冷静期）」进行中节点收口为「退款已确认，提交微信中」。
- 倒计时归零后从单次刷新改为约 30 秒轮询，直到订单状态离开 refund_pending（转入退款中/已退款）后停止。
- 退款页对已进入退款流程（refund_pending）的订单不再呈现金额预览与「确认退款」入口，直接给状态说明与返回订单列表出路。
- 原型先行：docs/design-s/prototypes/order-detail.html STATES 表补该过渡态，ADJUSTMENTS.md 登记条目。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `s-pay-account-views`: 订单详情页新增「冷静期结束后的过渡展示」要求（不可再取消口径 + 出口 + 轮询流转）；退款流程页新增「对退款流程中订单状态直入、不呈现二次提交入口」要求。

## Design Impact

- 受影响端：**S端**。
- 受影响屏/弹层：订单详情页（/dashboard/orders/:orderNo）、退款页（/dashboard/orders/:orderNo/refund）。
- 对象状态：退款进行中对象新增一个展示层过渡子态「冷静期已结束·退款已启动」（不新增后端订单状态）；说明条语气由 warn 转入 info（不再是可操作警示）；沿用现有 notice/pill/btn 组件词汇，语气词仅用 info/warn，不新增档位或胶囊形态。
- 共享段：不触碰（仅消费现有 base.css 语义类）。
- 原型先行：本屏设计事实源 docs/design-s/prototypes/order-detail.html（STATES 表照抄），需先改原型并在 ADJUSTMENTS.md 登记，再改实现；注意 ADJUSTMENTS.md 当前有并行任务（orders.html tab 分版）的未提交改动，登记条目需各自成段便于分开提交。
- 设计工件：实现侧自查（S端无像素 parity 门禁），change 目录附页面截图对照。

## Impact

- 代码：server/frontend/src/views/pay/OrderDetailPage.vue（展示态判定/文案/操作区/时间线/轮询）、server/frontend/src/views/pay/RefundPage.vue（refund_pending 直入分支）。
- 后端零改动（订单详情接口已返回 status + refund.cooldown_remaining_seconds，前端本地判定足够）。
- e2e：server/frontend 全 mock e2e 补「冷静期已归零仍 refund_pending」场景；改交互后本地跑全量 S端 e2e。
- 门禁：design:lint、vue-tsc --noEmit、相关 e2e。
