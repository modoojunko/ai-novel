## Why

2026-09-02 实付演练单（S20260902-1E2B7B837401A54B，¥30 未激活全额退）暴露支付后体验两处断点：订单流程时间线「套餐到货」在已退款态显示 —（库里 fulfilled_at 有值）、激活环节整段缺失；「我的套餐」页看不到任何已购套餐。进一步排查发现**激活入口在产品里不存在**（`POST /pay/grants/activate` 前端零调用、无自动激活）：正常买家付款后套餐永远停在 pending_activation，按 s-payments spec「用户 SHALL 在我的套餐点激活」的要求，这是实现欠账，真实付费用户会撞上。

## What Changes

- **订单时间线补全**（S端 订单详情页）：「套餐到货」行当且仅当 fulfilled_at 非空时显示到货时间（不做状态猜测、不以支付时间冒充到货），并按设计原型折出激活状态（待激活/已激活计时中·剩余 X 天/已收回）；补「申请退款」环节行（refund_requested_at）；进行中环节按原型显示预计时间（等待支付=剩余秒数派生过期时刻、冷静期=截止时刻），修复「进行中环节为预计时间」文案与实现不符。
- **订单详情接口补字段**：`_order_to_detail` 增返 `fulfilled_at`、`refund_requested_at`、`grant`（该单 codes 行的 status/activated_at/expires_at 快照），前端不再从订单状态猜测到货与否。
- **激活入口落地**（S端 我的套餐页）：新增「待激活」区块，逐个套餐给出「激活」按钮（确认弹层说明激活即开始计时、退款转折算），调用既有 `POST /pay/grants/activate`；激活后刷新总览。
- **我的套餐明细列表**：`GET /pay/membership` 从 codes 台账聚合返回套餐明细（生效中/待激活/已收回），`pending_count` 改为真实统计（替换硬编码 0）；页面按原型 membership.html 渲染明细列表与状态 pill，已收回套餐灰显无操作，回应「看不到我买过的套餐」。
- **codes 时间口径治理**：codes 行插入统一显式写 naive UTC `created_at`（当前走 DB 列默认 `now()`，上海时区会话落库为上海本地时间裸值、被按 UTC 读，比 orders 快 8h）；只治增量不回填存量（无计算依赖，仅 admin 列表排序）。

## Capabilities

### New Capabilities
- `s-pay-account-views`: 支付用户视图——订单流程时间线的环节/时间/激活状态显示规则，我的套餐视图（档位头、套餐明细、待激活区块与激活入口）及其数据契约。

### Modified Capabilities
- `s-payments`: 到货-激活两段式 Requirement 增补台账行 created_at 写入口径（显式 naive UTC、不依赖列默认、存量不回填）——时间存储纪律归台账域，视图能力只管渲染。

## Design Impact

- **受影响端**：仅 S端（server/frontend）。
- **受影响屏/弹层**：订单详情页（时间线区块重排，无新弹层）；我的套餐页（新增待激活区块、套餐明细列表、激活确认弹层——复用 AppModal，确认族口径）。
- **对象状态**（对照状态语言总表）：订单六态 pill 不变；新增套餐行状态 pill 三态——待激活（warn）/ 生效中（ok）/ 已收回（tag 灰显），语气词沿用全站固定四态 info/ok/warn/err，不引入新语气词与新胶囊形态。
- **共享段**：不触碰两端共享 base.css 段（改动均在页面 scoped styles 与既有组件类内）。
- **原型先行**：S端 免原型流程；设计事实源沿用已入库的 `docs/design-s/prototypes/order-detail.html`（STATES 表时间线）与 `membership.html`（态一总览），本次为对齐实现；交付时附两端渲染截图对照入 change 目录。
- **设计工件**：实现侧自查（无设计侧会话）。
- **文案口径**（§13）：按钮词全部动词（「激活」「去激活」），用户可见文案不出现内部术语（pending_activation/台账/CAS 等一律转译为「待激活/套餐记录/……」）。

## Impact

- **后端**：`server/app/interfaces/web_api/payments.py`（`_order_to_detail` 补字段、`get_membership` 重写聚合）、新增 codes 按用户聚合查询（`pg_http/code_repo.py` + `sql/code_repo.py` 双实现）、`pg_http/code_repo.py` 插入路径显式 created_at。
- **前端**：`server/frontend/src/views/pay/OrderDetailPage.vue`（时间线 steps 重写）、`server/frontend/src/views/dashboard/MembershipPage.vue`（明细+待激活+激活确认）、`server/frontend/src/api/pay.ts`（MembershipView/OrderDetail 类型扩展）。
- **测试**：后端 payments 契约测试（新字段+membership 列表+时区断言）；S端 e2e mocks（api-handlers.ts）补字段，order-detail/dashboard-home spec 增场景。
- **文档**：`docs/prd/backend-detail-design.md` 附录 Z DTO 增量（fulfilled_at/refund_requested_at/grant/membership.grants）。
- **不触碰**：微信网关层、退款状态机、共享 base.css 段、C端。
