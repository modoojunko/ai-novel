## Context

订单状态机：fulfilled →（申请退款）refund_pending（冷静期 5 分钟）→（定时任务 R1 到点提交）refund_processing →（微信回调/R3 跟进）refunded。后端零改动：订单详情接口 `GET /pay/orders/:orderNo` 已返回 `status` 与 `refund.cooldown_remaining_seconds`（冷静期剩余秒数，过期返回 0/null）。

「到点提交」由外部定时扫描驱动（10 分钟一班），因此「冷静期归零 → 状态流转」之间存在前端可见的窗口。本设计把这个窗口变成一个显式过渡展示态，而不是让它伪装成「还可取消的冷静期」。

## Goals / Non-Goals

- Goals：窗口内不再出现任何可取消入口；如实告知退款已启动；自动轮询跟随状态流转；退款页不再误导二次提交。
- Non-Goals：不改后端状态机与接口；不改变 R1 扫描频率；不做「到点秒级提交」（用户已裁定不做对齐/提频）。

## Decisions

### D1：过渡展示态的判定（纯前端）

```ts
const cooldownSeen = ref(false)          // 倒计时是否已初始化过（防首载 null 误判）
const cooldownLeft = ref(0)

function startCooldown(seconds) {
  cooldownSeen.value = true
  ...
}

const cooldownElapsed = computed(() =>
  state.value === 'refund_pending' && cooldownSeen.value && cooldownLeft.value <= 0
)
```

- `cooldownSeen` 区分「尚未初始化」与「已归零」：首次加载即拿到 0/null 的单（用户中途打开）也直接进过渡态（对应 Scenario「直接打开已过冷静期的订单详情」，不得闪现倒计时）。
- 判定只用本地已有数据，不新增接口往返。

### D2：三处展示差异（OrderDetailPage）

- 状态说明条（info 语气）：「冷静期已结束，退款流程已启动，不能再取消。款项将原路退回您的微信，一般数分钟至 3 个工作日到账。」
- 操作区：移除「取消退款」，给「返回我的订单」（btn-secondary，router.push('/dashboard/orders')）。
- 时间线：`退款确认（冷静期）→ 退款已确认，提交微信中`（now 节点保持进行中标注，when 列显示 —）。

渲染分支顺序：`cooldownElapsed` 先于普通 refund_pending 分支，避免归零后闪回倒计时文案。

### D3：归零后轮询

- 倒计时归零触发首次 reload；若返回仍为 refund_pending，启动 30s 间隔轮询（window.setInterval），每次拉取后 status 离开 refund_pending 即清除。
- 轮询与既有 timer、onBeforeUnmount 清理统一管理；组件销毁必清。

### D4：RefundPage 状态直入

onMounted 分流补一个分支：`status === 'refund_pending'` → 渲染独立的「退款流程进行中」视图（info：退款已进入流程、套餐已停止使用；出口=「查看订单详情」+「返回我的订单」），**不走** `apiPayRefundPreview`。不在退款页重复倒计时/取消逻辑——取消的唯一入口在订单详情页（口径单源）。

### D5：原型先行（设计事实源）

1. `docs/design-s/prototypes/order-detail.html` STATES 表补「冷静期已结束·退款已启动」行（说明条/操作区/时间线三列口径照 D2）。
2. `docs/design-s/prototypes/ADJUSTMENTS.md` 追加登记段（该文件当前有并行任务 orders.html 的未提交改动，本次条目独立成段，提交时按任务拆分）。
3. change 目录附实现截图对照（S端一致性证据）。

## Risks / Trade-offs

- 「退款流程已启动」在 R1 尚未真正提交前是**略超前的口径**（提交发生在几秒~10 分钟后）：接受——对用户承诺的语义是「流程已启动且不可逆」，与后端 CAS（到点必提交、取消已失效）一致，不存在承诺落空路径（除非定时任务持续故障，那是可观测性议题，另有跟进）。
- 30s 轮询在窗口期最长持续 10 分钟（20 次请求）：量级可忽略，单用户场景无压力。
- 与并行变更 orders-status-tabs 同改 s-pay-account-views / OrdersPage：本变更不动 OrdersPage，归档时 delta 无重叠冲突。

## Migration Plan

单 PR：原型 + 实现 + e2e 一次落；部署走既有 CI（push main 自动发布）。无数据迁移、无接口变更。

## Open Questions

- 无（对齐/提频方案已被用户裁定不做，另行沉淀）。
