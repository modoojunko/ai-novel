## ADDED Requirements

### Requirement: JWT 携带 uid 且业务端点零身份翻译

登录/注册签发的 JWT SHALL 包含 `uid`（用户整型代理键）claim。严格版鉴权依赖 SHALL 要求 payload 含合法 `uid`（int 且非 bool），缺失或非法时返回 401（前端 401 拦截自动登出回登录页），MUST NOT 提供旧格式 token 的过渡兼容。授权依据 SHALL 只取 token claim 中的 `uid`，MUST NOT 接受任何请求参数/请求体/header 中的 user_id 替代。`uid` 为权威身份：注销后同名重注册的用户获得新 uid，旧 token 按 uid 查询只能看到空数据，MUST NOT 越权访问新账户数据。宽松版鉴权依赖（返回 None 而非 401 的形态）SHALL 保持 username 语义不变，C端桌面客户端设备端点不受本要求影响。

#### Scenario: 登录后业务请求零身份翻译

- **WHEN** 已登录用户请求任一业务读接口（订单列表/我的套餐等）
- **THEN** 服务端凭 token 中的 uid 直查业务表，users 表查询次数为 0

#### Scenario: 旧格式 token 被拒绝并引导重登

- **WHEN** 持有无 `uid` claim 的历史 token 请求业务接口
- **THEN** 返回 401，前端自动登出并回到登录页，重新登录后一切正常

#### Scenario: 注销重注册不越权

- **WHEN** 用户 A（uid=1）注销后，新用户注册了相同用户名（uid=2），A 的旧 token（uid=1）仍有效
- **THEN** 旧 token 请求订单/套餐接口，返回 uid=1 的数据（空），MUST NOT 返回 uid=2 的任何数据

#### Scenario: 宽松依赖保持 C端设备端点可用

- **WHEN** C端桌面客户端持用户名格式凭证调用设备端点（如 /api/devices/current）
- **THEN** 行为与本变更前一致，MUST NOT 因缺少 uid claim 被拒绝
