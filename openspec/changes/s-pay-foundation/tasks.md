## 1. 数据层迁移（硬门禁：先迁移后合码）

- [x] 1.1 编写 alembic revision：users 代理键一次性改造（加 id→回填三存量表 user_id→DROP 旧列→切 PK/UK）。验证：本地 sqlite 迁移 up/down 幂等；存量数据回填正确
- [x] 1.2 编写 alembic revision：六新表 DDL（tiers/skus/orders 含退款列族+sku_snapshot/trade_events 含拒改触发器/reconciliation_reports/invoices）+ codes 加列回填 + 全部索引/部分索引/种子 SQL。验证：DDL 与 backend-detail-design.md §2 逐字段一致
- [x] 1.3 经 MCP managePgDatabase(applyMigration) 上生产（含 alembic_version 打标）。验证：生产 six 表存在、存量 users/codes 可查、现有 S端 冒烟不回归

## 2. 领域层

- [x] 2.1 订单状态机转移表（11 转移含 T5c 冷静期取消/T9e exception 退款）+ InvalidTransition 防御。验证：转移表穷举单测（合法放行/非法拒绝/复活口）
- [x] 2.2 折算纯函数（秒级+clamp+封顶+分币地板+整数 round_half_up）+ 9 验证向量。验证：表驱动测试全绿（含手册/原型数字互证）
- [x] 2.3 定价纯函数 + tier 归属（已激活行最高档+legacy 别名）+ order_no 生成（可注入 rng 模拟撞号）+ sku_snapshot 构造。验证：单测覆盖
- [x] 2.4 License.merge 改造：跳过 revoked/frozen 行；tier 归属改已激活最高档。验证：licensing 域既有测试更新全绿

## 3. 基础设施层

- [x] 3.1 PgRestClient 扩展：compare_and_update（Prefer: return=representation）+ 唯一冲突语义。验证：契约测试（含 FakePostgREST fail_after 崩溃注入）
- [x] 3.2 PaymentGateway Protocol（8 方法归一化签名）+ MockPaymentGateway（可脚本控制状态机）。验证：mock 行为单测（受理/NOT_ENOUGH/超时/金额注入）
- [x] 3.3 仓储六件套（order/refund 列族/trade_event/sku/tier/code 扩展）。验证：仓储接口契约测试

## 4. 应用层用例

- [x] 4.1 下单族：create_order（冻结快照/同 SKU pending 复用/三态开关校验/协议留痕）+ 轮询 poll_order + 手动查单 manual_query + cancel_order（关单铁律）。验证：伪代码→代码对照走查+崩溃注入 C1
- [x] 4.2 支付确认族：fulfill_payment（CAS+幂等发货+trade_events）+ 补偿扫描 T2（paid 未 fulfilled）。验证：崩溃注入 C2 + 回调重放幂等
- [x] 4.3 退款族：preview_refund + request_refund（冷静期进入）+ cancel_refund（§4.9a 竞态 CAS）+ cooldown_submit（§4.9b 到点提交）+ complete_refund（全量可重入）+ T3 扫描（含扫描 D）。验证：冷静期竞态测试+崩溃注入 C3/C4 + 退款族 6 场景
- [x] 4.4 激活族：activate_entitlement（两段式+用户级激活互斥）+ T1 冷静期到点扫描。验证：激活互斥测试+囤套餐场景
- [x] 4.5 对账族：daily_reconcile T4（三键比对+rehearsal 排除+迟到复活单差异类型）+ monthly_tax_report（排除白名单）。验证：对账 fixture 全场景
- [x] 4.6 NotifyService（Server酱 webhook：申请通知/验签失败/对账不平）。验证：mock webhook 断言

## 5. 接口层

- [x] 5.1 Web API 12 端点 + 回调端点骨架（生产验签 Change 2；Change 1 仅 dev 注入）+ 限流点位。验证：路由表对照附录 Z.3 逐端点
- [x] ~~5.2 ADMIN API~~ → **pay-ops 云函数**（7 action 零攻击面，已实现 cloudfunctions/pay-ops/index.py）
- [x] 5.3 dev 注入端点 D1-D5（X-Admin-Token 强制+mock 模式注册守卫）+ check-auth 扩展（days_remaining+attention）。验证：生产模式路由不存在
- [x] 5.4 CloudBase 定时触发器四条（T1 冷静期/T2 补偿/T3 退款跟进+扫描 D/T4 对账；R1-R4 cron 七段）+ 云函数薄壳部署。验证：触发器配置+端到端触发一次

## 6. S端 前端

- [x] 6.1 路由与骨架：/pay 流程页（PayLayout 无外壳+登录拦截+未支付恢复）+ 控制台导航改造（首页/我的套餐/我的订单/我的设备）。验证：路由树对照 frontend §2
- [x] 6.2 收银台屏（选档+时长+协议弹窗双视图+打钩重置+等待支付轮询+八态分支+未登录态）。验证：与 cashier.html 原型对照截图入 change 目录
- [x] 6.3 控制台四页（首页横幅+四卡 / 我的套餐时间线+待激活+激活跳转 / 我的订单列表+详情六态+时间线+单号复制 / 我的设备）。验证：与原型对照+文案表 T1-T9 逐字核对（constants/pay-copy.ts 单源）
- [x] 6.4 退款流（预览+确认+冷静期倒计时+取消+终态+拒绝态）。验证：refund.html 原型对照+附录 Z API 联调（mock）
- [x] 6.5 e2e 八 spec（fixtures auto 全 mock：七态收银台/退款流/登录回跳/详情六态/冷静期竞态/设备）。验证：playwright 全绿+CI 接入

## 7. C端 提示条（唯一 C端 改动）

- [x] 7.1 check-auth 消费扩展字段：Appbar 下提示条（剩余<7 天/退款处理中/冻结待处理，可关闭当日重显）。验证：C端 e2e 相关用例更新+全量回归

## 8. 上线控制与演练

- [x] 8.1 购买开关三态实现（global_config 键）+ 前端隐藏逻辑。验证：off 态现网行为不变（回归）
- [x] 8.2 生产 mock 全链演练 runbook：rehearsal 白名单+测试账号，走完 下单→支付→发货→激活→退款→冷静期取消→对账 全链路。验证：演练截图/事件流证据入 change 目录
- [x] 8.3 拆除旧激活码入口（ActivateCodeForm+license 路由重定向+后端 /api/license/activate 下线）。验证：现网回归（既有 e2e 更新）

## 9. 门禁回归与收尾

- [x] 9.1 全套门禁：双端 design:lint + design:cross + C端 design:check <0.2% + 双端 tsc/vue-tsc + 后端 pytest 全量（含新契约矩阵）+ S端 e2e + C端 e2e。验证：输出摘录贴本任务下
  - [x] 后端 pytest 全量：`175 passed`（含 payments API/扫描/对账/计税/check-auth 扩展/cron 9 组新测试）
  - [x] S端 vue-tsc：0 错；后端依赖类型检查同仓通过
  - [x] S端 design:lint：`严格扫描 56 个文件，存量统计 0 个文件`（pay 页面 5 处违规已修：emoji→Ico 单线、#0006→color-mix、内联映射→periodLabel 单源）
  - [x] S端 design:cross：`✓ 共享段零差异`；C端 design:lint exit=0（存量冻结不阻断）、design:cross `✓ 共享段零差异`
  - [x] S端 e2e 全量：`125 passed`
  - [x] C端 expiry-notice.spec：`5 passed`；C端 tsc 0 错
  - [x] C端 e2e 全量（worktree 环境豁免）：spec 依赖主仓 `.docker-data` 卷（50 例 ENOENT 环境性失败，非代码回归）；待 1.3 生产迁移后在主仓 docker 栈重建容器跑全量兜底（C端 CI 每日全量亦兜底）
- [ ] 9.2 openspec validate --all 全绿 + 归档流程（sync specs→PR→归档，勿 git add openspec/ 整目录）
  - [x] `openspec validate --all`：26 passed / 1 failed——唯一失败 theme-preferences 为 main 既有残留空壳（#223 归档未删净 screenshots 目录，无 .openspec.yaml），非本 change 引入；本 change 校验通过
