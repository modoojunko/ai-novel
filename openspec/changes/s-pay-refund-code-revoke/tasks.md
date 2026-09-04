## 1. 仓储层：三处同改 + 取数方法

- [x] 1.1 `server/app/infrastructure/repositories/base.py` 新增 `revoke_queued_for_order(order_no, anchor)` 抽象签名与文档字符串（anchor=该单 refund_requested_at；只收回 active+grant_start 为空或 > anchor 的行；返回行数）；时间值一律 naive UTC（`gt.` 比较串用 naive isoformat，禁 aware）。旧 `revoke_unconsumed_for_order` 保持不动；验证：import 无错、既有调用方零改动
- [x] 1.2 `server/app/infrastructure/repositories/sql/code_repo.py` 实现：单 UPDATE CAS `status='active' AND code_id=O-{order_no} AND (grant_start IS NULL OR grant_start > anchor)`（sqlite 单语句 OR，与设计文档 §3.2e 一致）；验证：单测覆盖排队中收回 1 行、已起算 0 行、未激活 0 行、grant_start==anchor（严格大于边界）0 行
- [x] 1.3 `server/app/infrastructure/repositories/pg_http/code_repo.py` 实现：读该单 active 行后按 grant_start 空/非空分 `is.null` / `gt.<anchor_iso>` 两支 `update_cas`（design decision 2 双分支式，anchor_iso 为 naive isoformat）；验证：pg_http 单测（mock 客户端）两分支各 1 例 + sqlite/pg_http 行为一致性用例（含 grant_start==anchor 边界同判）
- [x] 1.4 `server/app/infrastructure/repositories/payments_repo.py` OrderRepo 双实现新增 `find_refund_succeeded()`（语义与既有 `find_refund_succeeded_between` 同源：refunded + refund_status=succeeded，供扫描 E 取数）；验证：双实现单测各 1 例

## 2. 应用层：退款成功路径

- [x] 2.1 `server/app/application/payments/refund_flow.py` `complete_refund`：在旧收回调用旁以 `refund_requested_at` 为 anchor 并列调用 `revoke_queued_for_order`，两个收回动作移出 `status≠refunded` 守卫改无条件可重入；新收回命中行经 `get("O-"+order_no)` 读行取 grant_start/expires_at（revoked 后两列仍在）作 payload，追加事件 `codes:{code_id}:revoked:queued`；验证：单测——全额退排队中码被收回且事件恰一条（payload 含两时间字段）、重放不重复、已起算码不动
- [x] 2.2 三入口幂等重放用例（R1 冷静期到点提交 cooldown_submit / R3 跟进 / 微信回调，三者汇聚到 `complete_refund`）：各自重放一次全链状态不变；验证：pytest 参数化三入口
- [x] 2.3 边界用例：cancel_refund（refund_pending→fulfilled 解冻）后 revoked 行不被洗回；refund_processing 期间码不动；验证：pytest 两例
- [x] 2.4 域函数边界用例：grant_start==退款确认时刻时 calc_refund_fen 走已起算折算、CAS 判已起算不收回（两侧严格大于对齐）；below_one_fen 拒退路径不触发任何收回调用（调用序列断言）；验证：pytest 两例

## 3. R3 扫描 E：自愈通道

- [x] 3.1 `server/app/application/payments/scan_orders.py` `scan_refund_followup` 增加扫描 E：`find_refund_succeeded()` 取单 × source='order' active+排队中码（以各单 refund_requested_at 为锚）→ 调 `revoke_queued_for_order` + `:queued` 事件；验证：单测四例——命中存量形态、幂等重放 0 行、已起算豁免、**未退款 fulfilled 单的排队码不动**（防扫描扩源误伤的回归锚）
- [x] 3.2 扫描 E 结果计入 R3 端点返回 `actions`（`server/app/interfaces/web_api/cron.py` 无签名变化）；验证：cron 端点测试 actions 计数含 E 项

## 4. 契约与回归

- [x] 4.1 既有退款/激活/注销全量回归 pytest 通过（折算口径零变化的断言保持绿）；验证：`venv python -m pytest` 全绿
- [x] 4.2 ruff 过闸；验证：lint 0 违规
- [x] 4.3 S端 e2e 全 mock 回归不受影响（订单/套餐 tab 断言不涉本次内部状态机变化）；验证：playwright 本地绿

## 5. 上线与线上验证

- [ ] 5.1 v* tag 发版（s-server-deploy 门禁+部署），探活 skus/check-auth；验证：部署日志 success + 版本列表新 tag
- [ ] 5.2 首轮 R3 观测（现触发频率小时级，预期等待窗口为小时级，勿为此提频）：扫描 E 命中 = 存量 3 行（user 3 两行 2126 起算 + user 5 演练一行 2028 起算）、重跑 0 行；验证：CLS 日志 + 只读 SQL `SELECT count(*) FROM codes c JOIN orders o ON c.order_id=o.id WHERE c.source='order' AND c.status='active' AND o.status='refunded' AND o.refund_status='succeeded' AND (c.grant_start IS NULL OR c.grant_start > o.refund_requested_at)` 归零（上线后短期内核验）
- [ ] 5.3 我的套餐页复核：三条涉事码移入「已收回」tab，永久码与已起算权益不受影响；验证：线上 DOM 快照
