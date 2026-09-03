## Why

激活链三名收敛（s-api-naming-convergence）清的是 URI/符号层；**字段与数据层**的 grant 借词是当时明确划出的非目标，现在清账。且另一条线（license-grants-pagination）上分页明细时把错位放大了：新端点 URI 就叫 `/license/grants`、总览新增 `grant_count` 字段——对象是 ActivationCode（codes 表行，行内主键都叫 code_id），却全程叫 grant。消费面已核实全部为 S端 控制台自调（C端 桌面零引用），同仓同发，套「旧字段/旧路径过渡→零引用→删除」成例。

## What Changes

- **BREAKING**（同仓同发+双发/别名兜底）：`GET /api/pay/license/grants` → `GET /api/pay/license/codes`（旧路径过渡别名）；总览字段 `grant_count` → `code_count`（旧字段双发过渡一期）；订单详情快照 `grant` → `fulfillment`（到货——订单状态机 fulfilled 的名词化，零新词；本单到货码行的激活状态投影，引用非订单属性；旧字段双发过渡一期）
- 后端符号：`list_license_grants`→`list_license_codes`、`_LIST_GRANT_STATUSES`→`_LIST_CODE_STATUSES`、仓储 `find_order_grants_page`→`find_order_codes_page`（base 接口 + pg_http/sql 双实现）
- 前端符号：`LicenseGrant`→`LicenseCode`、`LicenseGrantPage`→`LicenseCodePage`、`apiPayLicenseGrants`→`apiPayLicenseCodes`、`OrderGrant`→`OrderCode`、CSS 类 `grant-row`→`code-row`（含 e2e locator 同批）；删除 `LicenseView.grants?` 死字段（后端已不内嵌明细、前端零消费）
- 保留（裁定记账）：`grant_start` 字段连同 codes 表列名不动——"起算日"既成名，DB 迁移成本远大于收益；`pending_count` 本就无错位
- e2e/测试/文档同批：mocks、license.spec locator、test_payments_api、test_jwt_uid_claim、backend-detail 附录 Z 与分页段落、frontend-detail

**非目标**：
- `grant_start` 及 codes 表列名（保留，理由入 design）
- openspec 归档历史记录
- client_api 冻结契约（本案不涉及）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `s-payments`: ① MODIFIED「License 总览接口命名对齐域对象」——总览字段枚举 grants 明细行改为 code_count，注明明细已独立分页；② ADDED「License 明细与快照字段层对齐域对象 code」——分页端点 URI、code_count、订单快照 code、双发/别名过渡与移除判据

## Impact

- **后端**：`web_api/payments.py`（路由×2+字段×2+符号）、`repositories/base.py`、`repositories/pg_http/code_repo.py`、`repositories/sql/code_repo.py`（方法名）
- **前端**：`api/pay.ts`（类型×4+URL）、`views/dashboard/LicensePage.vue`（符号+CSS 类）、`views/pay/OrderDetailPage.vue`（读取键）、`e2e/mocks/api-handlers.ts`、`e2e/tests/license.spec.ts`
- **测试**：`test_payments_api.py`、`test_jwt_uid_claim.py`
- **文档**：backend-detail-design（附录 Z 总览行+分页行+订单详情 grant 行）、frontend-detail-design（分页段落）
- **部署**：push main 自动部署；旧字段双发+旧路径别名覆盖窗口期

## Design Impact

- 受影响端：**S端**（C端 零引用）
- 受影响屏：我的套餐页明细 tab（字段/CSS 类换名，视觉零变化）、订单详情页激活快照区（同）
- 对象状态/文案/共享段：零触碰
- 原型：免（纯字段/符号改名，零视觉变化）；实现侧自查截图对照
