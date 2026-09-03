# 设计：订单页响应慢优化

## Context

生产链路：浏览器 → www.awesomenovel.com（静态托管 + /api 分流）→ CloudBase 云托管容器（MinNum=0 缩零）→ pg_http（PostgREST 网关 `tcloudbasegateway.com`，每次查询一趟 HTTPS 往返）。

实测（2026-09-03 本机 curl 生产）：不打 DB 的请求基线 ~0.3s；每次 pg_http 查询 +150–250ms（skus 0.4–0.55s 对照）。订单列表一次请求 = 3 次串行查询（`get_id` → `count_by_user` → `find_by_user`，见 `payments.py:181-196`）；前端进页默认「待支付」tab 为空时串行补一发探测（`OrdersPage.vue:51-57`）。详见 proposal Why。

关键约束：
- pg_http 与 sqlite 双模式贯穿仓储层，任何取数改动必须双实现。
- `get_id` 被 payments 全部 9 处端点、删除服务（deletion_service，account-deletion 已在 main）共用——缓存影响面是全站，不只是订单页。
- 删号是软标记（users 行不物理删除），`get_id` 查询不过滤 deleted → 缓存不改变现有语义；但 account-deletion change 在途演进，需留失效钩子。
- 每次归档过的口径：响应结构 `{items, total}` 零 breaking。

## Goals / Non-Goals

**Goals**
1. 订单列表接口从 3 次 DB 往返降到 1 次（缓存命中时），接口耗时 ~0.8–1s → ~0.4–0.5s。
2. 首屏空态探测从串行两连发变并行单拍。
3. 切 tab 不白屏：旧列表保留置灰，失败不误报空态。
4. 双模式（pg_http / sqlite）语义一致，测试全绿。

**Non-Goals**
- 冷启动策略（MinNum=0 保持，既有拍板）。
- JWT 结构变更（user_id 进 claims 方案，见 Alternatives）。
- 其它页面/接口的专项优化（get_id 缓存顺带受益，不逐页改造）。
- `list_orders` 端点 async def 内同步阻塞事件循环的问题（低流量单用户下无用户可见影响，另立议题）。

## 方案

### 1. 后端：count + find 合并为一次往返

`PgRestClient.find` 扩展：传 `want_count=True` 时附 `Prefer: count=exact`，从响应 `Content-Range`（`0-19/45` 尾段）解析 total，返回 `(rows, total)`；网关不回 Content-Range 时降级为现状（total=None，调用方回退单独 count——不改变现有 `count()` 方法）。已有 `count()`（client.py:107）证明网关支持该头。

`OrderRepo` 新增 `find_by_user_page(user_id, statuses, limit, offset) -> tuple[list[dict], int]`：
- pg_http：上述单请求。
- sqlite：一次 `q.order_by(...).all()` 后 `len()` 计数 + 切片 offset 窗口（个人订单量级，与 `count()` 注释里既有的规模假设一致）。
- 旧 `count_by_user` / `find_by_user` 保留不动（create_order、pending 恢复等其它调用方不受影响）。

`list_orders` 改调用 `find_by_user_page`，删除单独 count 步骤。

### 2. 后端：get_id 进程内 TTL 缓存

`PgHttpUserRepo.get_id` 内置模块级缓存：`dict[username, (user_id, expires_at)]`。
- TTL 300s；容量上限 512，超限整体清空（个人站点量级，简单压倒精确）。
- 只缓存命中（username 存在）；`None`（用户不存在）不缓存，保持"用户不存在"即时可见。
- 提供 `invalidate_id(username)` 钩子（账号注销/改名接线用）；account-deletion change apply 时接线，本 change 只交付钩子。
- sqlite 模式 `SqlUserRepo.get_id` 不加缓存（本地库微秒级，无需）。
- 线程安全：FastAPI 单进程事件循环 + 同步 httpx 调用全在循环线程上执行，dict 读写无竞争；不引入锁。

预期：登录会话内首个请求回源一次，此后全站 9 处端点的 get_id 均命中缓存，订单列表降到 1 次 DB 往返。

### 3. 前端：空态探测并行化

`fetchPage(reset=true)`：仅当「过滤 tab」（statuses 非空）时，主请求与 `apiPayOrders(1, 1)` 账号全量探测 `Promise.all` 并行；「全部」tab 免探测（`pageEmpty = total === 0`，口径等价）。现有 tabToken 过期丢弃逻辑对两个响应同样生效。

### 4. 前端：切 tab 不清空列表

`fetchPage(reset=true)` 不再预先 `items=[]` + 整页 `loading`：
- 已有数据时（tab 切换/刷新）：保留旧列表渲染，置灰（opacity 过渡）+ tab 条或列表尾局部加载指示；响应到达后整批替换 items/total。
- 无旧数据时（首次进页）：维持现状整页「加载中…」。
- 请求失败：console.error 后旧列表原样保留（现状 reset 预清空会让失败误显示「没有X的订单」空态——一并修掉）。
- 「加载更多」追加路径行为不变（loadingMore 状态已有）。
- pageEmpty/tab-empty 判定时机不变：响应到达后按新数据切换整页空态/tab 空态/列表三态。

### 渲染时序（改后）

```
进页（待支付 tab）:  [主请求+探测 并行] → ~0.4–0.5s 后整页渲染（get_id 缓存命中时）
切 tab:            旧列表置灰瞬时反馈 → ~0.4–0.5s 后整批替换（无白屏）
改前对照:           进页两连发串行 ~1.6–2s；切 tab 白屏 ~0.8–1s
```

## Alternatives（已否决）

- **user_id 进 JWT claims**：免查询最彻底，但涉及签发逻辑 + 全端重新登录 + token 结构口径变更，改动面远超本次目标；TTL 缓存以 1/10 的改动量拿到同等订单页收益。留作后续可选。
- **后端顺带返回 user_total 字段**：过滤 tab 下仍是串行 +1 查询（同步客户端难以并行），墙钟收益不如前端 Promise.all 并行，且加字段破坏「零 breaking」。
- **get_id 缓存放接口层装饰器**：与仓储实现绑定松散、双模式分发逻辑分散；放 `PgHttpUserRepo` 内聚且 sqlite 天然不受影响。

## Risks / Trade-offs

- 缓存过期窗口内（≤300s）用户改名/删号的解析结果滞后——现状软标记下 get_id 语义不变，实际无差异；account-deletion 后续如引入物理删除/改名，靠 `invalidate_id` 钩子收敛，最坏 300s 自愈。
- Content-Range 依赖网关行为——已有 `count()` 同头在生产稳定运行（订单页「共 Y 笔」就是它），降级路径保底。
- sqlite `find_by_user_page` 全取切片在订单量大时退化——与既有 `count()` 降级同款规模假设，S 端个人订单量级（数十）不触发。

## Migration / Rollout

纯代码行为优化，无 schema 变更、无配置项、无数据迁移。正常 PR → CI（pytest + e2e 全 mock）→ push main 自动部署。验证：本地 pytest 双模式全绿 + e2e 密闭复跑；上线后本机 curl 订单接口对照耗时。
