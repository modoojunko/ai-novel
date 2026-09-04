## Context

完整设计依据：`~/Desktop/knowledge/s-pay-refund-code-revoke-design-2026-09.md`（后端架构师 2026-09-04 牵头产出，含领域交叉矩阵/调用图核实/存量摸底/回滚）。本文件只留实现层决策。

生产约束：pg_http（PostgREST）无多表事务、生产 schema 手工维护（本变更零 DDL）、sqlite/pg_http 双仓储必须同改同测、naive UTC 存库、trade_events event_key 唯一键做幂等。

## Goals / Non-Goals

**Goals:**

- 退款成功时，「已激活·排队中」（active 且 grant_start 为空或 > now）的订单来源码被 CAS 收回并事件留痕
- R3 定时扫描幂等自愈，收敛存量 3 行漏网并兜底未来漏网
- 已起算权益与折算口径零扰动

**Non-Goals:**

- 不改折算公式 `calc_refund_fen`（全额退/按秒折算口径维持）
- 不改表结构、不做存量手工 DML
- 不动 2126 顺延日期语义与 #303 展示口径
- 不做套餐明细「已退款·权益已收回」文案（可后置另立 change）
- 不修 `find_refund_half_done` pg_http 过取（与本设计已解耦）

## Decisions

1. **新增独立方法 `revoke_queued_for_order` 而非扩参旧方法**：旧 `revoke_unconsumed_for_order` 语义（未激活收回）在注销执行等调用方仍在用，扩参会误伤；新方法独立 CAS 条件，调用点显式。备选（给旧方法加 flag）被否——布尔参数语义易漂移。
2. **pg_http 排队中条件用"读后逐行双分支 CAS"，锚点取 `refund_requested_at`**：PostgREST 单 filter 无法表达 `active AND (grant_start IS NULL OR grant_start > anchor)` 跨列 OR（`or` 参数值以 `(` 开头会被客户端误加 eq. 前缀）。落地：先查该单 active 行，按 grant_start 是否为空分 `is.null` / `gt.<anchor_iso>` 两支 update_cas；sqlite 单语句 OR、pg_http 两支式，语义等价即行为一致（复审 P1-7 定版）。**锚点 anchor = 该单 `refund_requested_at`（复审 P0 定版）**：折算金额按确认时刻锁定，相位判定必须同锚——若按 succeed 时刻判，冷静期 5 分钟窗口内跨起算点会复现"全额退+码保留"同构 bug，且扫描 E 若同用 now 锚会把漏网永久固化；refund_requested_at 是行上现成列、不随重放漂移，complete_refund 与扫描 E 判定恒一致。TOCTOU 安全性依据：active 行的 grant_start 一经写入不可变（激活是 pending_activation→active 一次性 CAS），窗口内不会从未排队翻成已起算。
3. **调用点移出 `status≠refunded` 守卫**：`complete_refund` 中两个收回动作改为无条件可重入执行（各自 CAS 天然幂等），崩溃重放时不必先依赖 orders 状态推进。事件 event_key `codes:{code_id}:revoked:queued`、payload 存 grant_start/expires_at（误收回恢复数据源）。
4. **存量收敛走 R3 扫描 E，不做手工 DML**：扫描条件「订单 refunded+refund_status=succeeded × source='order' 码 active+排队中」，与退款成功路径共用同一收回方法。上线后首轮 R3 即清掉存量 3 行，未来漏网同通道自愈。备选（一次性 DML）被否——多一条需要人肉看管的修复路径，且违背"补偿扫描自愈"既定架构。
5. **边界裁定**（已写入 delta spec 场景）：refund_processing 进行中不动；below_one_fen 拒退不涉收回；cancel_refund 只解冻 pending 侧、结构性洗不回 revoked（cancel 路径只做 orders CAS，从不触碰 codes 行）；一单一码（`O-{order_no}` 幂等键）+ refunded 终态堵死 replay 激活。复审 P2 勘误：批量入 active 口除激活 CAS 外还有 admin `activate()`（不写 grant_start）——此类 active+grant_start 空行落新方法 `is.null` 分支会被判排队中收回，与折算域函数 grant_start=None→全额退口径自洽（delta spec 已涵盖）。

## Risks / Trade-offs

- [误收回已起算码] → CAS 条件硬编码 grant_start 比较；事件 payload 可 DML 逆操作恢复；R3 扫描 dry 模式先跑一轮对拍 3 行存量预期
- [pg_http 网关不回 Content-Range 等怪癖影响扫描取数] → 扫描 E 取数走既定 find/count 同款路径，量级为个位数；测试双跑覆盖
- [R3 频率小时级（09-04 降频止损）导致存量收敛延迟] → 接受：非资金路径，晚几小时无用户影响；不为此提频（用户已否决提频）
- [revert 回滚] → 单版本 revert 即可；已收回的码不随 revert 自动恢复（需凭事件 DML 恢复，预期不发生）

## Migration Plan

1. 代码合入（三仓储 + complete_refund + 扫描 E + 测试），pytest 全绿走 v* tag 发版
2. 上线后观察首轮 R3 日志：扫描 E 命中行数应 = 存量 3 行；重跑应 0 行
3. 复核生产（一次性验证 SQL，含 grant_start 与 refund_status 双条件，上线后短期内核验有效）：`SELECT count(*) FROM codes c JOIN orders o ON c.order_id=o.id WHERE c.source='order' AND c.status='active' AND o.status='refunded' AND o.refund_status='succeeded' AND (c.grant_start IS NULL OR c.grant_start > o.refund_requested_at)` 应归零（已起算豁免行除外，当前无此类）
4. 回滚：revert tag 重建版本即可

## Open Questions

（无——拍板项已由用户采纳架构师建议：存量收、扫描自动收敛、文案后置、顺手项不修。）
