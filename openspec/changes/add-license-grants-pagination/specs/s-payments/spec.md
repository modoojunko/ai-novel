# s-payments Delta

## MODIFIED Requirements

### Requirement: License 总览接口命名对齐域对象

用户权益聚合总览接口的 URI 与代码符号 SHALL 取自实存域对象名（`license`），MUST NOT 引入域外词（如 membership）。接口返回内容为当前登录用户的 License 聚合视图（有效档位、最远到期、剩余时长、待激活数、订单来源套餐行计数），MUST NOT 内嵌套餐明细列表（明细由套餐明细分页接口承载）；`grant_count` SHALL 只数 `source='order'` 的台账行，与套餐明细分页接口「全部」筛选的 total 同过滤器，保证档位头计数与列表口径一致。

#### Scenario: 我的套餐总览走 license 路径

- **WHEN** 已登录用户请求 `GET /api/pay/license`
- **THEN** 返回 `code=0` 与 License 聚合视图（tier / remaining_sec / remaining_desc / max_expires_at / pending_count / grant_count），响应中不含 grants 明细数组
- **AND** 未登录请求返回 `code=4001`

#### Scenario: grant_count 与「全部」tab total 同口径

- **WHEN** 用户名下存在订单来源台账行与手工发放码
- **THEN** `grant_count` 等于 `GET /api/pay/license/grants`（不带 status 筛选）返回的 total，手工发放码不计入两者

#### Scenario: 旧路径过渡别名

- **WHEN** 客户端仍请求 `GET /api/pay/membership`
- **THEN** 返回与 `GET /api/pay/license` 完全相同的聚合视图
- **AND** 该别名为过渡兼容，前端线上包零引用后 MUST 移除

#### Scenario: 旧页面链接重定向

- **WHEN** 已登录用户访问前端旧地址 `/dashboard/membership`
- **THEN** 重定向到 `/dashboard/license` 并渲染同一 License 总览页
- **AND** 历史激活码地址 `/dashboard/license` 直接命中该页（原重定向规则由真身页取代），导航与各跳转入口全部指向新地址

#### Scenario: 前端符号单一命名

- **WHEN** 检查 S端 前端源码（router / api 客户端 / 视图组件）
- **THEN** 该资源的类型、请求函数、页面组件、路由名一律命名为 license 语义（LicenseView / apiPayLicense / LicensePage / route name `license`），仓库内存量 membership 符号仅剩后端过渡别名一处

## ADDED Requirements

### Requirement: 套餐明细分页接口

订单来源套餐明细 SHALL 由独立分页接口 `GET /api/pay/license/grants` 承载：`status` 参数为逗号分隔白名单 `{pending_activation, active, revoked}`（未登录返回 `code=4001`）；未知状态值 MUST 忽略，全部未知时返回空列表与 total=0（不报错）；分页参数 `page`/`page_size` 默认 20、上限 100 钳制；响应为 `{items, total}`，items 行结构与原 license 内嵌 grants 行逐字一致（code_id/order_no/tier/duration_days/status/activated_at/expires_at/grant_start）；列表 SHALL 按创建时间倒序排列（裁定：明细分页后不再按状态分组排序，与订单列表全局口径一致，「已收回」行的视觉区分由前端置灰承载）。

#### Scenario: 按状态筛选返回对应套餐行

- **WHEN** 已登录用户请求 `GET /api/pay/license/grants?status=pending_activation`
- **THEN** items 仅含待激活行，total 为待激活行总数；`status=active`、`status=revoked` 同理各自筛选

#### Scenario: 不带筛选返回全量分页

- **WHEN** 已登录用户请求 `GET /api/pay/license/grants`（无 status）
- **THEN** 返回名下全部订单来源行的第一页（按创建时间倒序），total 为全部行数

#### Scenario: 未知状态值不致命

- **WHEN** 请求携带 `status=bogus` 或 `status=active,bogus`
- **THEN** 未知值被忽略：前者返回空列表+total=0，后者等同 `status=active`；均不返回错误

#### Scenario: 分页追加口径

- **WHEN** 同一筛选条件下请求 `page=2`
- **THEN** 返回按创建时间倒序的下一页且 `total` 不变；前端据此判断「加载更多」是否还有下一页

#### Scenario: 手工发放码与历史无来源行不进明细

- **WHEN** 用户名下存在管理员手工发放的激活码，或历史台账行无 source 标记（按 admin 口径折算）
- **THEN** 这些行不出现在任何筛选条件的 items 中，也不计入 total

#### Scenario: 未登录照旧拒绝

- **WHEN** 未登录请求该接口
- **THEN** 返回 `code=4001`，与现有口径一致
