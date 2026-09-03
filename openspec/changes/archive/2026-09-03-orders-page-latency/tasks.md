# Tasks：订单页响应慢优化

## 1. 后端：取数合并与用户解析缓存

- [ ] 1.1 `PgRestClient.find` 支持 `want_count`：附 `Prefer: count=exact`，解析 `Content-Range` 尾段返回 `(rows, total)`；网关不回该头时 total=None（不改变现有 `count()` 方法行为）
- [ ] 1.2 `OrderRepo.find_by_user_page(user_id, statuses, limit, offset)`：pg_http 单请求取 (rows, total)；sqlite 一次查询自计数+切片；旧 `count_by_user`/`find_by_user` 保留不动
- [ ] 1.3 `PgHttpUserRepo.get_id` 进程内 TTL 缓存（300s、容量 512 超限清空、只缓存命中、提供 `invalidate_id(username)` 钩子）；sqlite `SqlUserRepo` 不加缓存
- [ ] 1.4 `list_orders` 端点改用 `find_by_user_page`，删除单独 count 步骤（payments.py）
- [ ] 1.5 单元测试：find_with_count 的 Content-Range 解析/降级；find_by_user_page 双模式口径与 find+count 分步一致；get_id 缓存命中/过期/None 不缓存/invalidate 生效（MockTransport 数请求数断言单往返）

## 2. 前端：OrdersPage 并行探测与保留列表

- [ ] 2.1 `fetchPage(reset=true)`：过滤 tab 的主请求与 `apiPayOrders(1,1)` 探测 `Promise.all` 并行；「全部」tab 免探测（pageEmpty = total===0）；tabToken 过期丢弃对两个响应生效
- [ ] 2.2 切 tab/刷新不清空列表：有旧数据时保留渲染+置灰+局部加载指示，响应后整批替换；首次进页维持整页「加载中…」；失败保留旧列表不误报空态
- [ ] 2.3 前端单测/e2e：切版等待期旧列表可见、失败不显示 tab 空态、空态判定结果与原实现一致（整页空态 vs tab 空态）、加载更多追加行为不回归

## 3. 验证与收尾

- [ ] 3.1 本地全量 pytest（venv python，双模式）+ ruff 全绿；S端 e2e 全 mock 密闭复跑（停 19000 容器验证法）
- [ ] 3.2 PR 合并 → push main 自动部署 → 本机 curl `/api/pay/orders`（带/不带 status）对照改前耗时，确认接口 ~0.4–0.5s 档；浏览器实测进页/切 tab 无白屏
- [x] 3.3 归档：openspec sync + 归档 PR；按规则产出归档总结落 ~/Desktop/knowledge/ 并更新记忆索引
