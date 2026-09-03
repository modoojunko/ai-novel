## ADDED Requirements

### Requirement: 激活动作接口命名对齐域对象 code

订单来源套餐的激活动作接口 URI 与代码符号 SHALL 取自实存域对象名（`code`，ActivationCode/codes 表），MUST NOT 使用域外借词（grant/entitlement）。激活语义（订单号换权益开始计时）、错误码与响应体字段口径保持不变。

#### Scenario: 激活走 codes 路径

- **WHEN** 已登录用户请求 `POST /api/pay/codes/activate` `{order_no}`
- **THEN** 行为与原 grants/activate 完全一致：到货态订单的台账行转为 active、返回 `{code_id, grant_start, expires_at, tier}`，非到货/不可激活错误码不变

#### Scenario: 旧路径过渡别名

- **WHEN** 客户端仍请求 `POST /api/pay/grants/activate`
- **THEN** 返回与 `POST /api/pay/codes/activate` 完全一致的结果
- **AND** 该别名为过渡兼容，前端线上包零引用后 MUST 移除

#### Scenario: 应用层符号单一命名

- **WHEN** 检查后端应用服务与接口层符号
- **THEN** 激活用例统一命名 activate_code（模块/函数/handler），仓库内存量 grant/entitlement 借词仅剩过渡别名一处
