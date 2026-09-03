## ADDED Requirements

### Requirement: License 总览接口命名对齐域对象

用户权益聚合总览接口的 URI 与代码符号 SHALL 取自实存域对象名（`license`），MUST NOT 引入域外词（如 membership）。接口返回内容为当前登录用户的 License 聚合视图（有效档位、最远到期、剩余时长、待激活数、订单来源套餐明细），字段口径与既有实现保持一致。

#### Scenario: 我的套餐总览走 license 路径

- **WHEN** 已登录用户请求 `GET /api/pay/license`
- **THEN** 返回 `code=0` 与 License 聚合视图（tier / remaining_sec / remaining_desc / max_expires_at / pending_count / grants 明细行），字段口径与原 membership 接口完全一致
- **AND** 未登录请求返回 `code=4001`

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
