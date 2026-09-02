## 1. 原型先行

- [x] 1.1 `docs/design-s/prototypes/order-detail.html` STATES 表补「冷静期已结束·退款已启动」行：说明条（info）/操作区（无取消退款，返回我的订单）/时间线（退款已确认，提交微信中）三列口径
- [x] 1.2 `docs/design-s/prototypes/ADJUSTMENTS.md` 追加独立登记段（不与并行任务 orders.html 改动混淆）

## 2. 订单详情页过渡态（OrderDetailPage.vue）

- [x] 2.1 `cooldownSeen` + `cooldownElapsed` 判定（D1：首载 0/null 直接进过渡态，不闪倒计时）
- [x] 2.2 状态说明条 info 文案分支（先于普通 refund_pending 分支）
- [x] 2.3 操作区：归零后移除「取消退款」、给「返回我的订单」
- [x] 2.4 时间线节点收口：「退款确认（冷静期）」→「退款已确认，提交微信中」
- [x] 2.5 归零后 30s 轮询至状态离开 refund_pending，onBeforeUnmount 清理

## 3. 退款页状态直入（RefundPage.vue）

- [x] 3.1 onMounted 补 `refund_pending` 分支：独立「退款流程进行中」视图（不调 preview、无确认入口）
- [x] 3.2 出口：「查看订单详情」+「返回我的订单」

## 4. 门禁与验证

- [x] 4.1 e2e（server/frontend 全 mock）：补「cooldown_remaining_seconds=0 仍 refund_pending」场景——断言无「取消退款」按钮、有返回出口、文案不再含「可取消」；补退款页 refund_pending 直入场景
- [x] 4.2 存量 e2e 回归 + 本地全量 S端 e2e 通过
- [x] 4.3 `npm run design:lint` + `vue-tsc --noEmit` 绿
- [x] 4.4 change 目录附订单详情页过渡态截图（对照 order-detail.html 原型）
