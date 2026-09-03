## Why

我的订单列表（/dashboard/orders）当前不分状态平铺，用户要在一列混合状态的订单里找"那笔没付的单"；且接口一次只拉最近 50 笔、无任何提示，更老订单静默不可见。2026-09-02 用户评审拍板：按状态 tab 分版（默认待支付），太多订单用「加载更多」。设计事实源 docs/design-s/prototypes/orders.html（2026-09-02 tab 分版修订版）已评审通过。

## What Changes

- 我的订单列表改为 tab 五版：全部｜待支付｜已完成｜退款｜已过期；**默认选中待支付**（进页即聚焦未支付订单）
- 八种订单状态归组映射：pending→待支付；paid+fulfilled→已完成；refund_pending+refund_processing+refunded→退款；closed→已过期（含手动取消支付与超时自动关单两个来源）；exception（核对中）罕见态不设专属 tab、仅「全部」可见
- 各 tab 独立分页：列表尾「已显示 X 笔 · 共 Y 笔」+「加载更多」按钮，点击追加同筛选下一页
- tab 选中态随 URL query 同步（?tab=，刷新/回退还原）
- 某 tab 无订单时显示该类空态（没有X的订单 + 切回全部出口）
- **后端契约升级**：GET /api/pay/orders 新增 status 筛选（逗号分隔状态白名单）+ 真分页（page/page_size + total），替换"一次拉全量、分页参数预留"的现状；无 schema 变更

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `s-payments`: 订单列表接口新增按状态筛选与真分页契约（status 白名单参数、total 全量计数口径）
- `s-pay-account-views`: 我的订单列表页新增状态分版展示、默认待支付、加载更多与 tab 空态要求

## Impact

- 后端：`server/app/interfaces/web_api/payments.py`（list_orders）、`server/app/infrastructure/repositories/payments_repo.py`（find_by_user 加筛选 + count_by_user；sqlite 与 pg_http 双实现同改）
- 前端：`server/frontend/src/views/pay/OrdersPage.vue`（tab 条/加载更多/URL 同步/tab 空态）、`server/frontend/src/api/pay.ts`（STATUS_GROUPS 归组单源 + 请求参数）
- 无数据库 schema 变更（筛选全部走现有列，无 DDL；部署 pg_gate 自检照跑）
- 测试：后端 pytest 补筛选/分页/未知状态用例（双后端参数化）；S端 playwright 全 mock e2e 补 tab 分版用例
