# 设计：JWT 携带 uid

## Context

见 proposal。评审记录：架构师「有保留通过」，三条硬性修订已吸收——①payments.py `_current_username` 是第 4 处 JWT 消费方（不走 deps），必须一并改造；②`get_current_user_or_none` 保持宽松防 C端桌面存量 token 误伤；③设备页不改传 uid（device_registry.user_id 存的就是用户名，改了反而匹配不到行）。

关键事实：JWT 消费方全仓仅 3 处路径（deps 两函数、payments `_current_username`、C端心跳 `verify_license` 只读 sub）；HS256 对称签名 payload 不可篡改；线上无真实用户。

## Goals / Non-Goals

**Goals**
1. web 业务端点凭 token uid 直查业务表，users 表查询次数 = 0。
2. 旧格式 token 401 自动登出重登，无过渡兼容层。
3. 拆除 TTL 缓存及其失效接线（净减易错机制）。

**Non-Goals**
- C端心跳、设备子系统 user_id=用户名语义、身份域 username 把手、前端与 API 响应结构。
- 改名功能（不存在；uid 权威性为未来改名铺路）。

## 方案

### 1. 签发（jwt.py + login.py + register_user.py）

`sign_jwt(username: str, uid: int)`：payload = {sub, username, uid, exp}。login 在验密后、register 在建户后各取一次 id（`user_repo.get_id(username)`，登录本就要查 users 表，1 次/登录可接受——缓存拆除后这是普通直查）。

### 2. 依赖分治（deps.py）

- `get_current_user`（401 版）：verify 后校验 `uid` 合法（`isinstance(uid, int) and not isinstance(uid, bool)`），非法/缺失 → 401。返回值改为双持 `CurrentUser(username, uid)`（轻量 NamedTuple）。
- `get_current_user_or_none`：**保持现状**（只解 username，无 uid 要求）。C端设备端点（client_api/devices.py 走此依赖）零感知。
- 授权只认 claim uid；全仓确认无端点从 Query/Body 收 user_id 参与授权（评审已扫，实施时复查一次）。

### 3. payments 端点（payments.py）

`_current_username(request)` 升级为 `_current_identity(request) -> tuple[str, int] | None`：解析 JWT + 校验 uid（同严格口径），失败返回 None（维持现有「返回 code=4001 壳」风格，不抛 HTTPException——与现有端点行为一致）。9 处端点改用 `(username, uid)`，传给仓储的统一是 uid int：
- orders 系：`OrderRepo.find_by_user_page(uid, ...)` 等。
- license：`find_all_by_username(username)` → `find_all_by_username(uid)`（`_resolve_user_id` int 直通，零查询）。
- create_order 的 `_create`、activate/refund 系列：user_id 参数直通。

`activate_code` 等应用层用例签名已是 `user_id`，无需改。

### 4. 拆缓存（user_repo.py）

- 删：`_ID_CACHE_TTL_SECONDS`/`_ID_CACHE_MAX_ENTRIES`/`_id_cache`/`invalidate_id`/容量清空逻辑/`create()` 里的失效调用。
- 留：`resolve_user_id(client, username)` 退化为普通直查（grant_repo/_resolve_user_id、C端激活链仍用）；`PgHttpUserRepo.get_id` 委托它；`code_repo._resolve_user_id` int 直通保留。
- 注释里的「MUST 走共享解析」规约保留但改写：web 路径已无解析（uid 来自 token），该函数仅服务身份域/C端 username 输入。

### 5. 测试

- token mint：conftest/各测试的造 token 路径统一走 `sign_jwt(username, uid)`；sqlite 契约测试的 uid 必须与播种用户的真实 id 一致（取 `user_repo.get_id` 或播种返回值）。
- 计数断言：orders 列表单往返断言中 users 查询本就不在该请求内（缓存时代 MockTransport 数的是 find+count），改为断言「users 表 0 查询」。
- 新增：旧格式 token（sign 后手工去掉 uid 或直接构造 payload）→ 401；注销重注册越权边界；宽松依赖对无 uid token 仍放行 username。
- 双模式（sqlite/pg_http MockTransport）同改。

## Risks / Trade-offs

- 未盘到的 JWT 消费方会被 401——全仓 `verify_jwt` 仅 3 处已核，上线盯 401 率；回滚 = 回滚镜像（无数据迁移，旧 token 已作废、重登零成本）。
- `uid` claim 与 users 表漂移（如手工改库）——uid 是 PK 不可变，正常流程不漂移；pg_gate 体系外不设防（与现状同等信任级别）。

## Migration / Rollout

单 PR → CI → push main 自动部署。无 schema/配置/数据迁移。部署后旧 token 全量作废属预期行为。
