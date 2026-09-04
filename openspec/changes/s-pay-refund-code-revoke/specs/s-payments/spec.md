# s-payments Delta

## MODIFIED Requirements

### Requirement: 退款五分钟冷静期
用户确认退款时系统 SHALL 立即冻结对应权益（停止使用）并按确认时刻锁定折算金额（秒级公式、四舍五入到分、不足 1 分拒退、未激活/排队中全额退），随后进入 5 分钟冷静期：期间用户可取消（解冻恢复使用、终点不变、不补偿、refund_status=canceled 终态）；到点由定时任务自动提交微信原路退款；提交后不可自助撤销。退款成功 SHALL 按 **权益相位** 回收对应订单来源码（仅该单，其余不重算），相位判定 SHALL 以**该单退款确认时刻（refund_requested_at，即折算金额锁定时刻）为锚**，与金额锁定同锚、不随重放时刻漂移：

- **未激活**（unused/pending_activation）→ 置 revoked（既有行为）；
- **已激活·排队中**（active 且 grant_start 为空或 > 锚时刻）→ 置 revoked，并追加 `codes.revoked` 事件（event_key 以 `:queued` 后缀区分，payload SHALL 留存 grant_start/expires_at）；
- **已激活·已起算**（active 且 grant_start ≤ 锚时刻）→ 不收回（按秒折算保留剩余权益）。

折算公式与全额退/折算退款口径不变；收回动作 MUST 幂等可重入，且 MUST NOT 依赖修改表结构。

#### Scenario: 冷静期取消
- WHEN 用户在倒计时内点「取消退款」且定时提交尚未执行
- THEN CAS refund_pending→fulfilled 先到者赢，权益解冻恢复使用，金额前科进 trade_events 留痕

#### Scenario: 冷静期到点与用户取消竞态
- WHEN 倒计时归零瞬间用户同时点取消
- THEN 先完成 CAS 者生效（取消赢则恢复；提交赢则返回"已提交不可撤"4007）

#### Scenario: 排队中码随全额退款收回
- WHEN 某单的码已激活但 grant_start 在该单退款确认时刻之后（排队中，如排百年永久档之后），该单退款成功
- THEN 该码 CAS 置 revoked 且追加 `codes:{code_id}:revoked:queued` 事件（payload 含 grant_start/expires_at）；退款金额为确认时刻锁定的全额（未起算口径），两判定同锚不因冷静期窗口翻转

#### Scenario: 已起算码退款后保留
- WHEN 某单的码 grant_start ≤ 该单退款确认时刻（已起算），该单按剩余时长折算退款成功
- THEN 该码保持 active 不动，剩余权益继续有效

#### Scenario: 收回动作重放安全
- WHEN 退款成功路径因崩溃或重试被重放（三入口：R1 冷静期到点提交 cooldown_submit、R3 跟进、微信回调）
- THEN 已 revoked 的码再次执行收回返回 0 行且不报错、不重复追加事件（event_key 唯一键幂等）；重放前后相位判定同锚（refund_requested_at 为行上既有值）

#### Scenario: 取消退款不洗回已收回的码
- WHEN 某码已随历史退款被置 revoked，其后同单出现冷静期取消或任何重放
- THEN revoked 行不被恢复为 active（取消路径只做 orders CAS 与解冻，从不触碰 codes 行）

#### Scenario: 退款进行中码不动
- WHEN 某单处于 refund_pending / refund_processing（尚未 succeeded）
- THEN 其订单来源码保持当前态，不提前收回；到 succeeded 才按确认时刻锚一次判定

### Requirement: 补偿式一致性（无事务环境）
生产环境（PostgREST 无多表事务）下所有多步写 SHALL 遵循：单语句 CAS + 唯一约束幂等键 + 补偿扫描自愈。每个崩溃窗口 MUST 有恢复路径：支付半截（paid 未发货）由 T2 扫描补发货；退款半截（refund_status=succeeded 但 orders.status≠refunded）由扫描 D 重放退款成功路径补回收（未激活行同批收回）；orders 已 refunded 而订单来源码仍 active+排队中（以该单 refund_requested_at 为锚判定）的漏网由 R3 扫描 E 收敛：CAS 收回并追加 `:queued` 事件——既收敛存量漏网行，也兜底未来漏网。回调处理 MUST 全量可重入（CAS 输但已成功→继续剩余步骤）。

#### Scenario: 退款完成中途崩溃
- WHEN refund_status→succeeded 后、codes revoke 前进程崩溃
- THEN 扫描 D 发现该半截态并重放回收步骤（幂等），最终 orders→refunded 且全链一致

#### Scenario: 存量排队中漏网行自愈
- WHEN 历史退款成功单（orders 已 refunded）的订单来源码仍为 active 且 grant_start 为空或 > 该单 refund_requested_at（如 2126/2028 起算的存量 3 行）
- THEN R3 扫描发现并 CAS 收回、追加 `:queued` 事件；重跑扫描 0 行新增（幂等）

#### Scenario: 自愈不误伤已起算权益
- WHEN 扫描遇到退款成功单但其码 grant_start ≤ 该单 refund_requested_at（已起算）
- THEN 不收回、不产生事件，该行保持 active（按秒折算保留剩余权益的既定口径）
