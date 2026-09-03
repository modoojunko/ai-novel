## 1. 后端（筛选 + 真分页）

- [x] 1.1 `OrderRepo.find_by_user` 增加可选 `statuses` 筛选参数（不传=现状行为），新增 `count_by_user(statuses)` 同口径计数；sqlite 与 pg_http 双实现同步修改
- [x] 1.2 `GET /api/pay/orders`：解析 `status` 逗号分隔白名单（未知值忽略，全未知=空列表）、`page`/`page_size`（默认 20、上限 100）；响应加 `total`；不带 `status` 时行为与现状一致
- [x] 1.3 pytest：筛选命中、未知状态容错、分页 total 口径、未登录/无用户 4001；sqlite + pg_http 双后端参数化（契约层 conftest 全局还原口径不破）

## 2. 前端（tab 分版 + 加载更多）

- [x] 2.1 `api/pay.ts`：`STATUS_GROUPS` 归组单源（pending→待支付 / paid+fulfilled→已完成 / refund_pending+refund_processing+refunded→退款 / closed→已过期）+ `apiPayOrders` 支持 status/page 参数、`OrderListResult` 加 `total`
- [x] 2.2 `OrdersPage.vue`：`.seg` tab 条五版（默认待支付）+ `?tab=` 路由同步（router.replace，默认值省略参数）+ tab 切换竞态令牌（D7）
- [x] 2.3 加载更多：尾块「已显示 X 笔 · 共 Y 笔」+「加载更多」按钮、追加按 order_no 去重、无下一页时按钮消失
- [x] 2.4 tab 空态（没有X的订单+切回全部出口）；整页空态时 tab 条不渲染
- [x] 2.5 对照原型自查：tab 词汇/归组/默认态与 docs/design-s/prototypes/orders.html 一致，design-lint 过（site-beian.ts emoji 为 main 存量，非本改动引入）

## 3. 验证与交付

- [x] 3.1 本地全量 pytest 绿（deploy 部署前门禁同款口径，import app 走 venv python）——290 passed
- [x] 3.2 S端 playwright 全 mock e2e：进页默认待支付 / 切 tab 过滤正确 / 加载更多追加去重 / tab 空态出口 / URL 刷新还原——148 passed（orders.spec 9 用例重写）
- [x] 3.3 实现截图 vs 原型对照（分版列表/某类空/长列表三态）入 change 目录 `evidence/screens/`（impl-*.png + proto-*.png 各四张）
- [x] 3.4 PR 合并部署后线上复验：**已合并（#279，main@38d679f）+ 自动发布跑完（pg_gate success/后端云托管 success/前端前端步 CI 两次跨境超时失败→本机 tcb app deploy staging 兜底上线 novel-s-web-081）**；线上探针 ✓（orders 4001 口径、skus 200、live OrdersPage chunk 含全部 tab 标记与修复版 watcher）；登录态人肉复验由用户完成（2026-09-03 归档指令=复验确认）
