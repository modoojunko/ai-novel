# JWT 携带 uid——消灭每请求身份翻译（jwt-uid-claim）

## Why

业务表外键全站是整型 user_id，但 JWT 凭证里只有 username（sub），导致每个 web 请求都要做一次 username→id 翻译。pg_http 环境下这次翻译就是一趟 150–250ms 的数据库往返。已做两轮止血（count/find 合并、TTL 缓存），高频接口已到地板，但翻译动作本身仍存在于冷路径与缓存未命中窗口，且缓存带着「注销重注册失效补丁」这类易错机制。线上当前无真实用户，旧 token 作废（强制重登）零成本——治本窗口就是现在。

## What Changes

- `sign_jwt(username, uid)`：payload 增加 `uid`（int）claim，login/register 签发时顺带解析（登录本就要查 users 表）。
- 严格版依赖 `deps.get_current_user` 要求 payload 含合法 `uid`（int 且非 bool），缺失/非法 → 401（前端 401 拦截自动登出回登录页）；**不做旧 token 过渡兼容**。
- 宽松版依赖 `get_current_user_or_none` 保持宽松（无 uid 仍返回 username）——C端桌面客户端的设备端点（/api/devices/current 等）30 天 token 窗口内不受影响。
- payments.py 的 `_current_username`（第 4 处 JWT 消费方，不走 deps）同步升级为返回双持身份，9 处端点改用 uid；license 端点 `find_all_by_username(username)` 改传 uid（仓储解析函数 int 直通）。
- **设备页 `/api/devices/my`/remove 维持 username 不改**——device_registry 的 user_id 列存的就是用户名，该链路今天已是零翻译直查。
- 拆除 TTL 缓存：`resolve_user_id` 退化为普通直查函数（C端激活/授权路径仍用），删除缓存字典、`invalidate_id` 钩子及全部接线点。
- uid 为权威身份：注销→同名重注册后，旧 token（uid=旧id）按 uid 查询只见空数据、不越权新账户（pytest 锁定）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `account-security`：JWT 契约变更——token 携带 uid、严格版鉴权要求合法 uid（旧格式 401）、宽松版依赖保持 username 语义、uid 为权威身份不可被请求参数替代。

## Impact

- `server/app/infrastructure/security/jwt.py`（签发签名）、`server/app/application/identity/login.py` + `register_user.py`（取 uid 签发）。
- `server/app/interfaces/deps.py`（严格/宽松分治）、`server/app/interfaces/web_api/payments.py`（`_current_username` 升级 + 9 处端点改 uid）。
- `server/app/infrastructure/repositories/pg_http/user_repo.py`（拆缓存）。
- 测试：token mint 统一 helper、users 查询计数断言下调为 0、注销重注册越权边界用例、sqlite 双模式同改。
- 不改动：前端（只透传 token）、C端心跳 `verify_license`（只读 sub）、设备子系统 user_id=用户名语义、身份域 username 把手、API 响应结构。
