## Why

退款折算域函数把「已激活·排队中」（active 且 grant_start 为空或在未来）的权益码判为未起算→全额退，但收回函数 `revoke_unconsumed_for_order` 的 CAS 条件只覆盖 unused/pending_activation——排队中的码被全额退款后永留在 active 态，钱货两失（生产实锤：modoojunko 两行 + rehearsal_demo 一行，trade_events 有 activated→refund.succeeded 全程却无 codes.revoked 事件）。

## What Changes

- 新增 `CodeRepo.revoke_queued_for_order`：CAS 只收回「active 且 grant_start 为空或 > 该单退款确认时刻（refund_requested_at，与折算金额锁定同锚）」的订单来源码；已起算（正在消耗）的码一律不动，按秒折算保留剩余权益的既定口径零改动。base/sqlite/pg_http 三仓储同改。
- `complete_refund`（退款成功）与旧的未激活收回并列调用新动作，并移出 `status≠refunded` 幂等守卫（可重入）；补 `codes.revoked` 事件，event_key 带 `:queued` 后缀，payload 留 grant_start/expires_at 作误收回恢复数据源。
- R3 定时扫描新增幂等自愈项（扫描 E）：退款成功单 × 订单来源码仍 active+排队中（以各单 refund_requested_at 为锚）→ 收回+事件。既是存量 3 行的修复通道，也是未来漏网的自愈兜底。
- 边界裁定（不改变行为，仅明确）：refund_processing 进行中码不动；below_one_fen 拒退不涉收回；cancel_refund 结构性洗不回 revoked（CAS 只 pending_activation→active）；一单一码 + refunded 终态堵死 replay 激活。
- 不改表结构（生产 schema 手工维护约束）；不改折算公式；不动 2126 顺延日期（定性为排百年永久码后的正确顺延，#303 已修展示；reconcile/tax_report 只读 paid_at/refunded_at 不受影响）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `s-payments`: 「退款五分钟冷静期」Requirement 的退款成功收回条款细化为分相位口径（排队中码 SHALL 收回、已起算码 SHALL 保留）；「补偿式一致性」Requirement 的扫描 D 补回收范围扩展到排队中码（现口径只收回未激活行，与本变更后的收回函数同源扩展）。

## Impact

- 后端：`server/app/infrastructure/repositories/{base,sql/code_repo,pg_http/code_repo}.py`（三处新增收回方法）、`server/app/application/payments/refund_flow.py`（complete_refund 并列调用）、`server/app/application/payments/scan_orders.py`（R3 扫描 E）、`server/app/interfaces/web_api/cron.py` 无签名变化。
- 契约：无 API 形状变化（codes 行 status 迁移为内部状态机；license 接口已能表达 revoked 行）。
- 生产数据：存量 3 行（user 3 两行 2126 起算 pro、user 5 演练一行 2028 起算 pro）由 R3 扫描上线后自动收敛，无手工 DML（用户已采纳"扫描自动收敛"路径）。
- 测试：域函数 × 收回交叉用例、三仓储 CAS 条件双跑（sqlite+pg_http）、三入口幂等重放、R3 扫描用例。
- 风险与回滚：单版本 revert 即可；误收回可凭 codes.activated 事件 payload 做 DML 逆操作恢复。

## Design Impact

本变更无用户可见界面改动（S端 零屏变更；被收回的码按既有 LicensePage「已收回」tab 呈现，展示文案细化已裁定可后置）。不触碰两端共享段，无需原型先行。后续若做「已退款·权益已收回」文案细化，另立 change 走设计侧会话。
