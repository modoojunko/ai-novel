# Proposal: add-license-grants-pagination

## Why

我的套餐页的「套餐明细」把生效中/待激活/已收回全部混列一屏，且 `GET /pay/license` 无限内嵌全量 grants——每笔已完成订单都会生成一条套餐行，这个响应体是无界增长的（订单页早已服务端筛选+分页）。用户评审要求比照「我的订单」按类型 tab 分版；tab 化正是把明细改为服务端分页、清掉无界债的时机。设计已三轮架构评审放行（设计事实源：docs/design-s/prototypes/license.html 2026-09-03 tab 分版修订版 + ADJUSTMENTS.md 同日四条登记）。

## What Changes

- **BREAKING（后端契约，用户裁定单阶段直接切换：当前线上无用户，不做 compat 窗口）**
  - `GET /api/pay/license` 瘦身：响应**删除** `grants` 内嵌明细，**新增** `grant_count`（只数 `source='order'` 行，与「全部」tab total 同过滤器）；其余字段（tier/remaining_sec/remaining_desc/max_expires_at/pending_count）不变。
  - 新增 `GET /api/pay/license/grants?status=&page=&page_size=`：status 逗号分隔白名单 `{pending_activation, active, revoked}`（未知值忽略、全未知=空列表+0）、分页默认 20 上限 100、响应 `{items, total}`、行结构与原 grants 行逐字一致、`created_at` 倒序（**「全部」tab 行序裁定为时间倒序**，不再按状态分组——pg_http 客户端表达不了 CASE 排序，与订单页全局口径一致）。
  - repo 层新增 `find_order_grants_page`（CodeRepo Protocol + sqlite / pg_http 双实现，镜像 `OrderRepo.find_by_user_page` 分页先例；历史无 source 列的行折为 admin、不进明细）。
- 前端「我的套餐」订单化改造：四 tab（全部/生效中/待激活/已收回）默认版=生效中、`?tab=` URL 同步、每 tab 独立分页 +「加载更多」（按 code_id 去重）、切版置灰防闪、tabToken 防过期响应；三层判定改 grant_count 口径（tab 条=grant_count>0 / 整页空态=grant_count===0&&remaining_sec<=0 / 手工码态=grant_count===0&&remaining_sec>0）；激活成功 `postActivateRefresh()` 单入口（reload hero + 仅待激活 tab 时切「全部」，防双拉取）；tab 补 `role="tab"`/`aria-selected`/`role="tabpanel"`。
- 测试同批：backend pytest 的 grants 断言迁移至新端点（含 `test_jwt_uid_claim.py:100` 这处范围外漏网断言，漏改即合并红）；e2e license.spec.ts 重写（新 mock 结构/四 tab/URL 同步/三态空态/旧后端退化态/激活后刷新）。

## Design Impact

- 受影响端：**仅 S端**（C端不消费 `/pay/license`，已核实全仓消费面：payments.py + tests + LicensePage/DashboardHome + e2e mock，无其他消费方）。
- 受影响屏：`/dashboard/license` 我的套餐页（LicensePage.vue）；DashboardHome.vue 仅消费 pending_count（保留，不受瘦身影响）。
- 对象状态：复用状态语言既有三态 pill——生效中(pill-ok)/待激活(pill-warn)/已收回(pill-tag)，零新增状态；tab 用 base.css 既有 `.seg` 词汇（已核实全局存在 :131-134），零新组件。
- 共享段：**不触碰** base.css 共享段，无双端同步义务；`role="tab"`/`aria-selected` 为可访问性属性补课（订单页同缺陷记为技术债，本次不顺手修，另立小项）。
- 原型：已完成（license.html tab 分版修订版，切换器四演示态：分版列表/某类空/手工码态/空态），ADJUSTMENTS.md 已登记，免再走原型先行。
- 设计工件产出方：实现侧自查（本 change 附原型与截图为对照证据）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `specs/s-payments/spec.md`：MODIFIED「License 总览接口命名对齐域对象」——聚合视图去 grants、增 grant_count；ADDED「套餐明细分页接口」——新端点契约（URI/status 白名单语义/分页钳制/total 口径/排序裁定/手工码与历史 NULL source 行排除）。
- `specs/s-pay-account-views/spec.md`：MODIFIED「我的套餐展示订单来源套餐明细」——数据源改新分页接口、空态判定改 grant_count 口径；ADDED「我的套餐明细按状态分版展示」（四 tab/默认版生效中/URL 同步/已收回置灰/激活后 tab 去留）+ ADDED「我的套餐明细分版列表的分页加载」（加载更多/去重/某类空/整页空态/切版置灰/失败保留旧列表）。

## Impact

- 后端：`server/app/interfaces/web_api/payments.py`（license handler 瘦身 + 新端点）、`server/app/infrastructure/repositories/base.py`（Protocol）、`server/app/infrastructure/repositories/sql/code_repo.py`、`server/app/infrastructure/repositories/pg_http/code_repo.py`。
- 前端：`server/frontend/src/api/pay.ts`、`server/frontend/src/views/dashboard/LicensePage.vue`。
- 测试：`server/tests/test_payments_api.py`、`server/tests/test_jwt_uid_claim.py`、`server/frontend/e2e/tests/license.spec.ts`、`server/frontend/e2e/mocks/api-handlers.ts`。
- 部署：单阶段，前后端同批上线，无 compat 窗口（用户裁定：当前线上无用户）。
