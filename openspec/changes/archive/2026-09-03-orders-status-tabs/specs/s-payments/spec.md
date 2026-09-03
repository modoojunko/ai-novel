## ADDED Requirements

### Requirement: 订单列表按状态筛选与真分页

我的订单列表接口 `GET /api/pay/orders` SHALL 支持服务端筛选与真分页：`status` 参数接受逗号分隔的订单状态白名单（pending / paid / fulfilled / refund_pending / refund_processing / refunded / closed / exception），筛选与计数同口径；`page` / `page_size` 分页返回，响应 SHALL 含 `total`（符合筛选条件的全量笔数）供前端「已显示 X 笔 · 共 Y 笔」计数。不带 `status` 时返回全部状态。筛选仅作用于现有列，MUST NOT 引入 schema 变更。

#### Scenario: 按状态筛选返回对应订单

- **WHEN** 已登录用户请求 `GET /api/pay/orders?status=paid,fulfilled&page=1&page_size=20`
- **THEN** 只返回状态为 paid 或 fulfilled 的订单，按创建时间倒序，`total` 为该筛选条件的全量笔数

#### Scenario: 未知状态值不致命

- **WHEN** `status` 含未知值（如 `status=paid,foo`）
- **THEN** 未知值被忽略，按剩余合法状态筛选；全部值均未知时返回空列表而非报错

#### Scenario: 分页追加口径

- **WHEN** 同一筛选条件下请求 `page=2`
- **THEN** 返回按创建时间倒序的第 21~40 条，`total` 不变；前端据此判断「加载更多」是否还有下一页

#### Scenario: 未登录与无用户照旧拒绝

- **WHEN** 未登录或用户不存在
- **THEN** 返回 `code=4001`，与现有口径一致
