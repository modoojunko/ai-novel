# Tasks：JWT 携带 uid

## 1. 签发与依赖

- [ ] 1.1 `jwt.py`：`sign_jwt(username, uid)` 加 uid claim；文档注释标明严格依赖口径
- [ ] 1.2 `login.py`/`register_user.py`：验密/建户后取 uid（`user_repo.get_id`）传入签发
- [ ] 1.3 `deps.py`：`get_current_user` 要求合法 uid（int 非 bool，否则 401），返回 `CurrentUser(username, uid)`；`get_current_user_or_none` 保持宽松不动
- [ ] 1.4 `payments.py`：`_current_username` 升级 `_current_identity`（严格口径，失败返回 None 维持 4001 壳风格）；9 处端点改传 uid（license 端点 `find_all_by_username` 传 uid int）
- [ ] 1.5 复查：全仓无端点从 Query/Body/header 收 user_id 参与授权（评审遗留检查项）

## 2. 拆缓存

- [ ] 2.1 `user_repo.py`：删缓存字典/TTL/容量/invalidate_id/create 失效调用；`resolve_user_id` 退化为普通直查（保留，grant_repo 与 C端激活链在用）
- [ ] 2.2 相关注释更新（orders-page-latency 时代的「走缓存」表述改为 uid 直查口径）

## 3. 测试

- [ ] 3.1 token mint 统一 helper（sign 带 uid，uid 与播种用户 id 一致）；sqlite 契约测试同改
- [ ] 3.2 新增：旧格式 token（无 uid）→ 严格依赖 401 / 宽松依赖放行 username；非法类型（bool/str uid）→ 401
- [ ] 3.3 新增：注销→同名重注册，旧 token（uid=旧）查询只见空数据不越权
- [ ] 3.4 更新：原「users 查询计数」断言改为业务请求 users 表 0 查询；TestUserIdCache 等缓存用例删除；grant_repo 直查用例适配
- [ ] 3.5 e2e：全 mock 不受影响，确认 153 不回归；如涉 401 流程用例按新契约校对

## 4. 验证与收尾

- [ ] 4.1 全量 pytest（双模式）+ ruff 改动文件全净；本机全量 e2e
- [ ] 4.2 PR 合并 → 部署 → 线上验收：新登录 token 打订单/套餐接口 users 查询 0（MockTransport 层面已断言，线上 curl 0.3s 地板 + 旧格式 token 401 实测）；盯 401 率
- [ ] 4.3 归档 + 知识总结落 ~/Desktop/knowledge + 记忆索引 + master.md
