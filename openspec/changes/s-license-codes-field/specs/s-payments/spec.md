## MODIFIED Requirements

### Requirement: License 总览接口命名对齐域对象

用户权益聚合总览接口的 URI 与代码符号 SHALL 取自实存域对象名（`license`），MUST NOT 引入域外词（如 membership）。接口返回内容为当前登录用户的 License 聚合视图（有效档位、最远到期、剩余时长、待激活数、订单来源套餐行计数）；明细列表由独立分页端点承载（见「License 明细与快照字段层对齐域对象 code」）。

#### Scenario: 我的套餐总览走 license 路径

- **WHEN** 已登录用户请求 `GET /api/pay/license`
- **THEN** 返回 `code=0` 与 License 聚合视图（tier / remaining_sec / remaining_desc / max_expires_at / pending_count / code_count）
- **AND** 未登录请求返回 `code=4001`

#### Scenario: 旧路径过渡别名

- **WHEN** 客户端仍请求 `GET /api/pay/membership`
- **THEN** 返回与 `GET /api/pay/license` 完全相同的聚合视图
- **AND** 该别名已随 s-pay-license-naming 收尾移除（现为终态行为：旧路径 404）

#### Scenario: 旧页面链接重定向

- **WHEN** 已登录用户访问前端旧地址 `/dashboard/membership`
- **THEN** 重定向到 `/dashboard/license` 并渲染同一 License 总览页
- **AND** 历史激活码地址 `/dashboard/license` 直接命中该页（原重定向规则由真身页取代），导航与各跳转入口全部指向新地址

#### Scenario: 前端符号单一命名

- **WHEN** 检查 S端 前端源码（router / api 客户端 / 视图组件）
- **THEN** 该资源的类型、请求函数、页面组件、路由名一律命名为 license 语义（LicenseView / apiPayLicense / LicensePage / route name `license`），仓库内存量 membership 符号仅剩历史文档表述

## ADDED Requirements

### Requirement: License 明细与快照字段层对齐域对象 code

套餐明细分页端点、总览行计数字段、订单详情权益快照 SHALL 以实存域对象名（`code`）命名：`GET /api/pay/license/codes`、总览字段 `code_count`、订单详情快照 `fulfillment`（到货——订单状态机 fulfilled 的名词化，零新词；本单到货产出的码行激活状态投影，引用非订单属性）。旧 URI/旧字段以过渡别名与双发兼容，前端线上包零引用后 MUST 移除。`grant_start` 为 codes 表既成列名连同响应字段裁定保留（"起算日"既成名，不入本轮）。

#### Scenario: 明细分页走 codes 路径

- **WHEN** 已登录用户请求 `GET /api/pay/license/codes?page=1&status=pending_activation`
- **THEN** 行为与原 license/grants 完全一致：items 行含 code_id/order_no/tier/duration_days/status/activated_at/expires_at/grant_start，total 为筛选全量计数，未知 status 白名单外值忽略
- **AND** 未登录请求返回 `code=4001`

#### Scenario: 总览计数与订单快照双发过渡

- **WHEN** 已登录用户请求 `GET /api/pay/license` 与 `GET /api/pay/orders/{order_no}`
- **THEN** 总览同时返回 `code_count` 与 `grant_count`（同值），订单详情同时返回 `fulfillment` 与 `grant`（同内容）
- **AND** 双发为过渡兼容，前端线上包零引用旧字段后 MUST 移除

#### Scenario: 旧分页路径过渡别名

- **WHEN** 客户端仍请求 `GET /api/pay/license/grants`
- **THEN** 返回与 `GET /api/pay/license/codes` 完全一致的结果
- **AND** 别名为过渡兼容，前端线上包零引用后 MUST 移除

#### Scenario: 字段层符号单一命名

- **WHEN** 检查前后端源码
- **THEN** 明细行类型/仓储方法/分页函数一律命名 code 语义（LicenseCode / LicenseCodePage / apiPayLicenseCodes / find_order_codes_page / list_license_codes），grant 借词仅剩 grant_start 既成字段与过渡别名/双发字段
