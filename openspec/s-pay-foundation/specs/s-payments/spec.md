## ADDED Requirements

### Requirement: 订单全生命周期状态机
订单（根对象）SHALL 以状态机管理生命周期：pending→paid→fulfilled 为主干；closed（可复活 closed→paid）/ exception（金额核对冻结）为分支；退款族 fulfilled→refund_pending（冷静期）→refund_processing→refunded。每次状态转移 SHALL 用单语句 CAS（WHERE 期望旧态）执行，非法转移在领域层拒绝。

#### Scenario: 同一订单并发回调只发货一次
- WHEN 微信回调与定时查单同时确认同一笔支付
- THEN 仅先完成 CAS pending→paid 的一方执行发货，另一方读到已 paid 走幂等分支
- AND codes 台账行恰好插入一行（order_no 部分唯一索引兜底）

#### Scenario: 关单竞态不丢钱
- WHEN 关单请求在途时用户完成支付
- THEN 关单必须先查单确认未支付才许置 closed；已支付的订单允许 closed→paid 复活并发货

### Requirement: 冻结快照与金额一致性
订单 SHALL 在创建瞬间冻结套餐事实（sku_id 引用 + sku_snapshot JSONB + amount_fen），后续 SKU 配置变更不影响已创建订单的解释、发货与退款折算。全链路金额 SHALL 使用 int 分；支付回调金额与订单金额不一致时订单 SHALL 进入 exception 终态并告警，绝不发货。


#### Scenario: 改价不影响已下单订单
- WHEN 用户以 ¥292 下单后运营将包年改价为 ¥350
- THEN 该订单的退款折算仍按快照 ¥292 计算，收银台轮询与详情页金额一致

#### Scenario: 金额不符冻结不发货
- WHEN 回调金额与订单冻结金额不一致
- THEN 订单进入 exception 终态并触发告警，绝不发货，等待人工处置
### Requirement: 到货-激活两段式
支付确认后系统 SHALL 立即落权益台账行（codes，状态 pending_activation），用户 SHALL 在「我的套餐」点「激活」才开始计时（起点=当前最远到期日，顺延衔接）。未激活行不计时、不占设备额度、退款全额、永不过期。tier 归属 SHALL 按已激活行中等级最高者。

#### Scenario: 囤套餐
- WHEN 用户购买包年后选择"先存着"
- THEN 该行保持 pending_activation（不计时/不占额度）；用户随时可激活进入排队

### Requirement: 退款五分钟冷静期
用户确认退款时系统 SHALL 立即冻结对应权益（停止使用）并按确认时刻锁定折算金额（秒级公式、四舍五入到分、不足 1 分拒退、未激活/排队中全额退），随后进入 5 分钟冷静期：期间用户可取消（解冻恢复使用、终点不变、不补偿、refund_status=canceled 终态）；到点由定时任务自动提交微信原路退款；提交后不可自助撤销。退款成功 SHALL 回收对应权益行（仅该行，其余不重算）。

#### Scenario: 冷静期取消
- WHEN 用户在倒计时内点「取消退款」且定时提交尚未执行
- THEN CAS refund_pending→fulfilled 先到者赢，权益解冻恢复使用，金额前科进 trade_events 留痕

#### Scenario: 冷静期到点与用户取消竞态
- WHEN 倒计时归零瞬间用户同时点取消
- THEN 先完成 CAS 者生效（取消赢则恢复；提交赢则返回"已提交不可撤"4007）

### Requirement: 补偿式一致性（无事务环境）
生产环境（PostgREST 无多表事务）下所有多步写 SHALL 遵循：单语句 CAS + 唯一约束幂等键 + 补偿扫描自愈。每个崩溃窗口 MUST 有恢复路径：支付半截（paid 未发货）由 T2 扫描补发货；退款半截（refund_status=succeeded 但 orders.status≠refunded 或 codes 未 revoked）由扫描 D 补回收；回调处理 MUST 全量可重入（CAS 输但已成功→继续剩余步骤）。

#### Scenario: 退款完成中途崩溃
- WHEN refund_status→succeeded 后、codes revoke 前进程崩溃
- THEN 扫描 D 发现该半截态并重放回收步骤（幂等），最终 orders→refunded 且全链一致

### Requirement: 日对账与资金留痕
系统 SHALL 每日拉取微信账单与内部账逐笔三键比对（商户单号/交易单号/金额），不平即 Server酱告警；所有状态变化 SHALL 追加 trade_events（append-only，数据库触发器拒绝 UPDATE/DELETE，留存≥10 年）。月度计税报表 SHALL 排除演练白名单用户。


#### Scenario: 漏回调由对账兜底
- WHEN 一笔支付成功但回调与补偿扫描均未触达
- THEN 日对账发现微信侧有此单而内部账为 pending，记入 mismatch_detail 并告警
### Requirement: 购买入口三态开关
购买入口 SHALL 支持 off（默认，入口隐藏）/ rehearsal（仅白名单用户可下单，计税与对账排除白名单）/ on 三态；生产 mock 演练期 SHALL 处于 rehearsal；dev 注入端点 SHALL 强制 Admin 鉴权且仅在 mock 模式注册。

#### Scenario: 演练不污染税表
- WHEN rehearsal 态下白名单用户产生 mock 订单
- THEN 月度计税报表与日对账排除该用户的数据

### Requirement: 前后端联合契约
API 端点/DTO/错误码 SHALL 以 backend-detail-design.md 附录 Z 为唯一版本：错误码=数字码+前端映射表（HTTP 200+data.code）；对外 URL/API 只用业务标识（order_no/sku_key），内部 FK 用代理 id；微信单号=完整值下发+前端脱敏渲染。


#### Scenario: 错误码映射唯一
- WHEN 后端返回 data.code=4007
- THEN 前端按附录 Z.1 映射表唯一解析为 REFUND_ALREADY_SUBMITTED 并渲染对应提示
### Requirement: 发票功能暂缓守卫
发票功能 SHALL 整体暂缓：invoices 表随建但 API/前端全部不实现；相关代码以注释占位留恢复点，启用时另行立项。

#### Scenario: 暂缓期无发票入口
- WHEN 用户浏览任一订单详情
- THEN 不出现获取发票按钮与发票区块，后端发票端点返回 404
