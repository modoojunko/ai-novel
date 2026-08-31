# 生产 mock 全链演练 runbook（s-pay-foundation · 8.2）

> 目标：在真实生产环境、Mock 网关（无真实扣款）下走通 下单→支付→发货→激活→退款→冷静期取消→对账 全链路，验证管道与数据落地。
> 演练身份：`payments.purchase.enabled = rehearsal` + 演练白名单测试账号（数据不进计税报表与对账）。

## 〇、前置条件（一次性）

| # | 事项 | 方式 | 验证 |
| --- | --- | --- | --- |
| 1 | 生产 PG 六新表 + users 代理键迁移 | MCP `managePgDatabase(applyMigration)`（任务 1.3） | `tiers/skus/orders/trade_events/reconciliation_reports/invoices` 存在；存量 users/codes 可查 |
| 2 | alembic_version 打标 | 迁移同批插入 | `SELECT * FROM alembic_version` = head |
| 3 | 云函数 pay-ops 部署 | MCP `manageFunctions(createFunction)`，env 注入 TCB_PG_* | MCP invoke `gateway-state` 返回正常 |
| 4 | 云函数 pay-cron 部署 | 同上，env：`TARGET_BASE`（S端公网基址）、`CRON_TOKEN` | 手工 invoke `action=r1-scan-orders` → HTTP 200 |
| 5 | S端 环境变量 | CloudRun 控制台：`CRON_TOKEN`（与 pay-cron 一致）；`SERVERCHAN_SENDKEY` 可选 | R1-R4 定时触发器四条注册成功 |
| 6 | 演练配置（global_config） | MCP 直插或 pay-ops | `payments.purchase.enabled=rehearsal`；`payments.rehearsal.usernames=<测试账号>` |
| 7 | SKU 种子 | pay-ops `seed-catalog`（或 MCP 直插 tiers/skus） | `GET /api/pay/skus` 返回三档 |

## 一、全链路步骤（测试账号登录 S端）

1. **下单**：收银台选「PRO 包年」→ 协议弹窗打钩 → 去支付。
   - 验证：`orders` 出现 pending 行（`prepay_status=created`、`attach_sent='username|pro_yearly'`、快照冻结 23920 分）。
2. **模拟支付**（mock 专用）：MCP 调 `POST /api/dev/inject-payment`（X-Admin-Token，Body `{order_no}`）。
   - 等价于微信成功回调：`status pending→paid`，`trade_events` 增 `order.paid`。
3. **补偿发货**：等 R2（≤2 分钟）或 pay-ops 手工触发 T2。
   - 验证：`status paid→fulfilled`、`fulfilled_at` 落值、codes 生成「待激活」行。
4. **激活**：我的套餐 → 待激活卡「立即激活」。
   - 验证：codes 行 `status=active`、`grant_start=今日`、`expires_at=+365d`；C端 check-auth `days_remaining≈365`。
5. **退款申请**：订单详情 → 申请退款 → 预览折算额 → 确认。
   - 验证：`status fulfilled→refund_pending`、`refund_status=cooldown`、`cooldown_ends_at=+5min`；权益冻结（设备授权拒新绑定）。
6. **冷静期取消**：倒计时内点「取消退款」。
   - 验证：`refund_pending→fulfilled`、`refund_status=canceled`、权益恢复。
7. **重走退款 + 到点提交**：再次申请退款，等冷静期到点（R1 触发 §4.9b）。
   - 验证：`→refund_processing`、`refund.not_enough_retry`（mock 直接成功则 `refund.succeeded`）→ `status=refunded`、权益回收。
8. **对账**：R4（北京时间 07:00）或 pay-ops 手工触发。
   - 验证：`reconciliation_reports` 当日行 `status=skipped`（mock 网关）；切真实网关后同一机制产出 balanced/mismatch。
9. **证据归档**：以上每步截图 + `SELECT * FROM trade_events WHERE order_no='...'` 事件流 JSON，存本目录 `evidence/`。

## 二、验收口径

- [ ] 全链 8 步走通，`trade_events` 事件序完整可解释（created→paid→fulfilled→activated→refund.* →…）。
- [ ] 演练用户不出现在月度计税报表（`monthly_tax_report` 输出不含测试账号）。
- [ ] 对账报告 rehearsal 用户排除生效。
- [ ] 关闭开关（`enabled=off`）后，名单内用户下单也返回 4012。
- [ ] 拆旧入口回归：`/dashboard/license` 重定向我的套餐；`/api/license/activate` 404。

## 三、回退

- 任一步骤异常：`payments.purchase.enabled` 置 `off` 即时熔断（前端入口消失 + 下单 4012）。
- 演练脏数据：测试账号订单保留（演练口径隔离，不进资金报表）；如需清理仅删 `orders/codes` 对应行，`trade_events` append-only 不动。

## 四、Change 2 切换真实网关（备忘）

- `PAYMENTS_GATEWAY=wxpay` → dev_inject 端点自动消失（mock 守卫）；R4 对账从 skipped 转真实三键比对。
- 首日用 **1 分钱真实订单**走全链（§4.14 部署期验证），核对微信商户平台账单与 `trade_events` 一致。
