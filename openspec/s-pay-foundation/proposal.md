## Why

S端 扫码支付系统（`docs/prd/s-payment-explore.md` 定稿）的**地基实现**（Change 1/2 拆分中的 Change 1）：商户号凭据未到位不阻塞——全部支付链路通过 MockPaymentGateway 先行建成并全链路演练，凭据到位后 Change 2 仅替换网关实现。用户已通过 UX 原型评审（8 屏 + 故事地图，`docs/design-s/prototypes/`）与前后端详细设计评审（五轮架构师评审 PASS，`docs/design-s/backend-detail-design.md` 1685 行 + `frontend-detail-design.md` 1057 行）。

## What Changes

- **数据库**（一次性迁移到位，含 users 代理键改造）：users 加 id 主键（DROP username PK，存量三表 FK 切 user_id）；新建 tiers/skus/orders（含退款列族+sku_snapshot）/trade_events/reconciliation_reports/invoices【暂缓】六表 + codes 加列回填 + 拒改触发器 + 全部索引/种子
- **后端**：payments 限界上下文（domain 状态机+折算纯函数 / application 15 用例含冷静期三用例+补偿扫描×3+日对账 / infrastructure PaymentGateway Protocol+Mock+pg_http 扩展 / interfaces Web+ADMIN+dev 注入端点）；定时宿主=CloudBase 触发器+云函数薄壳；退款 5 分钟冷静期；到期-激活两段式
- **S端 前端**：八原型转实现（收银台含协议弹窗/控制台首页/我的套餐/订单/订单详情/退款流/我的设备）+ 登录拦截回跳 + 未支付订单恢复 + C端 check-auth 扩展（到期提示条数据）
- **上线控制**：购买入口三态开关（off 默认 / rehearsal 白名单演练 / on）+ dev 注入端点 Admin 鉴权 + mock 全链路生产演练 runbook
- **发票功能整体暂缓**（台账表随建、API/前端全部不实现、占位注释留恢复点）
- **范围外**（Change 2「微信集成」单独立项）：真实 WechatPayGateway + 验签 + 生产回调 + 商户凭据配置 + 1 分钱演练；发票流水线启用；支付宝通道

## Capabilities

### New Capabilities

- `s-payments`: S端 在线支付的完整行为契约——下单/支付确认/发货/激活/退款（含冷静期）/对账/购买开关的状态机与不变量，前后端联合契约（附录 Z）为 API 唯一版本

### Modified Capabilities

（无——design-system 未触碰共享段词汇，S端 新增布局类走本地 css）

## Impact

- **实现事实源**：`docs/design-s/backend-detail-design.md`（含附录 Z 联合契约+ER 图）+ `frontend-detail-design.md` + `docs/prd/s-payment-explore.md`（业务口径）
- **代码**：server/app 新增 payments 上下文 + models 迁移 + client_api check-auth 扩展；server/frontend 新增路由/组件/store/api；client/frontend 到期提示条（唯一 C端 改动）
- **部署**：先 MCP applyMigration（含 users 改造+六新表）→ 冒烟 → 合 PR（顺序是硬门禁）；Secrets 新增（CRON_TOKEN/SMTP 暂缓）；CI 新增 playwright spec
- **验收基线**：后端 pytest 契约矩阵全绿（含崩溃注入×冷静期竞态）；S端 e2e 全 mock 全绿；design:lint 绿；购买开关 off 状态下现网行为不变（隐藏入口）

## Design Impact

- **受影响端**：S端（主要）+ C端（仅到期提示条，消费 check-auth 扩展可选字段）
- **受影响屏/弹层**：S端 新增购买流程页（无控制台外壳）+ 控制台四页扩展 + 登录拦截态；C端 appbar 下提示条
- **对象状态**：订单状态机 11 转移（含 closed→paid 复活/exception/T5c 冷静期取消）；codes 四态+退款冻结；全部以八原型+附录 Z 为准
- **是否触碰共享段**：否——新增布局类全部落 S端 本地 css（design/dashboard.css 扩），词汇只用既有 pill/notice/btn 家族
- **原型先行**：已完成（八原型+ADJUSTMENTS 登记簿即为设计事实源，实现对照原型验收）
- **设计工件由谁产出**：设计侧已完成（本 change 消费）；实现侧自查对照原型+附录 Z
