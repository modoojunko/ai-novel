# 订单页响应慢优化（orders-page-latency）

## Why

我的订单页（/dashboard/orders）几条数据就肉眼感觉卡。实测定位（2026-09-03，本机 curl 生产环境）：卡顿与数据量无关，是每次操作的固定开销——后端一次订单列表请求串行打 3 次 pg_http HTTPS 往返（username→user_id 解析、count 计数、find 取行），每次查询 150–250ms，接口本身 0.8–1s；前端进页默认「待支付」tab 为空时又**串行**补一发空态探测请求（再 3 次查询），首屏合计 6 次串行往返 ≈ 1.5–2s；切 tab 时整列表先清空显示「加载中…」，白屏一闪放大等待感。

## What Changes

- **后端·count/find 合并**：订单列表的 total 计数与当前页取行合并为一次 PostgREST 请求（`Prefer: count=exact` + Content-Range，客户端已有现成读取实现），pg_http 模式 3 次往返 → 2 次；sqlite 测试模式单查询自计数，口径不变。
- **后端·user_id 解析缓存**：`PgHttpUserRepo.get_id` 加进程内 TTL 缓存（300s + 容量上限 + 主动失效钩子），命中后订单列表降到 1 次往返（~0.4–0.5s）；该解析在 payments 全部 9 处端点与删除服务共用，全量受益。缓存对调用方完全透明（get_id 本身不过滤 deleted，缓存不改变语义）。
- **前端·空态探测并行化**：某 tab 为空时的整页空态探测请求与主请求 `Promise.all` 并行（仅过滤 tab 为空时才需要探测；「全部」tab total 即账号全量，免探测），首屏从两连发串行变单拍。
- **前端·切 tab 不清空列表**：切 tab/刷新时保留已渲染列表置灰 + 局部加载指示，响应到达后整批替换；不再整页白屏「加载中…」。首屏（无旧数据）与整页空态行为不变。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `s-payments`：订单列表数据访问契约补充——total 与当前页单次往返取得、用户解析缓存透明性（响应结构 `{items, total}` 不变，零 breaking）。
- `s-pay-account-views`：订单分版列表的加载渲染行为——切版不清空已渲染列表、空态判定口径保持（整页空态 vs tab 空态仍正确区分）。

## Impact

- 后端：`server/app/infrastructure/repositories/pg_http/user_repo.py`（get_id 缓存）、`server/app/infrastructure/repositories/pg_http/client.py`（find 携带计数）、`server/app/infrastructure/repositories/payments_repo.py`（合并取数方法）、`server/app/interfaces/web_api/payments.py`（列表端点改调用）。
- 前端：`server/frontend/src/views/pay/OrdersPage.vue`（fetchPage 并行探测 + 保留列表渲染）。
- 关联在途 change：`account-deletion`（deletion_service 共用 get_id）——缓存提供 `invalidate(username)` 钩子，该 change apply 时可接线；当前删号是软标记，get_id 语义不因缓存改变。
- 不改动：MinNum=0 冷启动策略（既有拍板保持最低成本）、JWT 结构（user_id 进 claims 方案否决，见 design）、订单 API 响应结构。
