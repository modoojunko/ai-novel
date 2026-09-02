## Context

支付域后端（s-payments spec）与微信网关已上线，数据完备：orders 有 fulfilled_at/refund_requested_at 等 8 个时间列，codes 台账行含 status/activated_at/expires_at。欠账全在视图与契约层：订单详情 DTO 只下发 3 个时间；membership 是 5 字段简化聚合；`POST /pay/grants/activate` 无前端调用方；codes 插入走 DB 列默认 `now()`（上海时区会话）致 created_at 比 UTC 快 8h。设计事实源已存在：`docs/design-s/prototypes/order-detail.html`（STATES 六态时间线）与 `membership.html`（态一：档位头+待激活区块+明细）。生产为 PostgREST 无多表事务，沿用 CAS+幂等纪律。

## Goals / Non-Goals

**Goals:**
- 订单时间线按环节如实显示已发生时间与进行中预计时间，数据来自明确字段而非状态猜测
- 「我的套餐」成为已购套餐的唯一视图：明细（生效中/待激活/已收回）+ 真实待激活统计 + 激活入口
- codes 增量写入时间口径与 orders 对齐

**Non-Goals:**
- 不改支付/退款状态机、CAS 语义、微信网关层
- 不回填 codes 存量行时区偏差（无计算依赖）；不做发票（暂缓守卫不变）
- 不做设备额度区块与套餐时间线（原型中该项，另立项）；不做「已收回」行跳转订单
- exception（金额核对）态的时间线形态维持现状
- 管理员手工发放的历史激活码（source 非 order，如存量永久档）不进明细列表，仅继续计入档位头汇总——明细语义收敛为「订单来源套餐」

## Decisions

**D1 订单详情 DTO 追加字段，时间线仍由前端推导**：`_order_to_detail` 增 `fulfilled_at`、`refund_requested_at`（isoformat 字符串，同 created_at 现模式）与 `grant: {status, activated_at, expires_at} | null`（端点内用既有 `code_repo.find_by_order(order_id)` 取行，单订单一查，不做 JOIN——pg_http 无 join；order_id 为空时不兜底查询，grant=None）。前端 steps 继续推导，但到货行的数据源是硬口径：**当且仅当 fulfilled_at 非空显示到货时间**——paid（已支付未发货半截态）不显示到货行实际时间，绝不以 paid_at 冒充（架构师评审 P0：换猜测源=重犯被修的病）。备选（后端直接下发 steps 数组）否：契约改动大、e2e mock 全在前端、时间线文案属展示层。

**D2 membership 聚合复用 `find_all_by_username`，明细收敛为订单来源行**：既有方法返回该用户全部 codes 行（含手工码），明细过滤 `source='order'`（状态覆盖 pending_activation/active/revoked 全集，手工码的 unused 态天然不进来）；手工码（如存量永久档）仅继续计入档位头汇总（License.merge 口径不变）。空态判定=「无明细行且无生效权益」（remaining_sec<=0）——只有手工码的用户只看档位头不显空态，避免与汇总自相矛盾。端点内一批 `orders` in 查询把 order_id 映射成 order_no（source=order 行 order_id 恒非空，无落空形态；激活接口按 order_no 定位，待激活行必须带）。每行下发 `{code_id, order_no, tier, duration_days, status, activated_at, expires_at, grant_start}`；`pending_count` 改为明细中待激活行计数。返回结构：`{tier, remaining_sec, remaining_desc, max_expires_at, pending_count, grants[]}`（向后兼容追加，前端 `grants ?? []` 守卫旧后端）。备选（新增专用聚合查询）否：复用零新增仓储面。

**D3 到货行激活标注映射**：grant.status → `pending_activation`「待激活，未计时」/ `active`「已激活，计时中·剩余 X 天」（expires_at−now）/ `revoked`「已收回」；无 grant 行（异常存量）显示到货时间不带标注。refund_amount_fen 存在时「申请退款」行带折算金额文案。

**D4 激活确认弹层用 AppModal 确认族**：文案两条事实——激活即开始计时；此后退款按已使用时长折算（全额退窗口关闭）。按钮「确认激活」/「再想想」，成功 toast（ok）后 reload；接口错误按码映射为可理解文案并带「联系客服」出口（S端弹窗纪律：只准 AppModal 禁手写）。

**D5 codes 写入显式 created_at（只治增量，归 s-payments 域）**：`pg_http/code_repo` 的 `create()`/`create_from_order()` 及 `sql/code_repo` 同路径统一传 naive UTC created_at（复用 payments 域 `_naive_utc`/naive 口径）；列默认保留在库里但不再被使用，pg_schema 期望值不新增；不回填存量（仅 admin 列表排序用它）。该写入纪律以 MODIFIED delta 落在 s-payments「到货-激活两段式」（架构师评审 P1：存储口径属台账域，不留在视图 spec）。契约测试以「与订单 paid_at 秒级同口径」为主断言（<8h 弱断言贴着故障边界，弃用）。

**D6 明细档位名兼容 lifetime**：后端下发 tier key + duration_days，前端展示沿用现有映射并补 lifetime（历史永久档存量仍在生效）→「永久」；period 文案复用 `periodLabel`。tier 归属汇总仍走 `License.merge`（lifetime 归一 pro）；明细仅含订单来源行，档位显示如实取行内 tier key。

## Risks / Trade-offs

- [已收回行引发「退了款怎么还显示」疑虑] → 行文案明确「已随退款收回」，灰显无操作，与订单详情「对应套餐已收回」口径一致
- [激活即关闭全额退窗口，用户误触投诉] → 确认弹层强制过目两条后果文案；未激活前订单详情/退款预览已有「未激活可全额退」提示互为呼应
- [pg_http 字符串时间漏归一（#265 同款三犯）] → 新代码时间进出统一过 `_naive_utc`/`parse_dt`，契约测试对 pg_http 与 sqlite 双实现同跑
- [e2e mocks 未同步新字段致存量红] → api-handlers.ts 与测试同批改，PR CI 兜底
- [部署窗口] → 后端字段为纯追加（旧前端忽略未知字段），前后端同镜像单服务部署无跨版本窗口；回滚即回镜像
- [detail/membership 两读无事务（orders+codes），窗口内退款回收致快照瞬时陈旧（如 refunded+待激活）] → 视图级可容忍，以下一次刷新为准；design 明示避免后续误当 bug 修

## Migration Plan

单 PR：后端（DTO 追加+membership 重写+codes 写路径）与前端（两页+api 类型）同批，随 push main 自动部署（CI pytest 门禁+playwright 全 mock）。无 DDL、无数据迁移。回滚：回退镜像即可，无 schema 兼容负担。

## Open Questions

无——pill 具体变体与确认文案措辞在实现时对照 design-language §13/状态语言总表取，不影响契约与任务拆分。
