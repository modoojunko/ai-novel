# Design: add-license-grants-pagination

## Context

`GET /api/pay/license`（server/app/interfaces/web_api/payments.py:462-505）现内嵌全量订单来源 grants（python 侧 `_status_order` 状态分组+时间倒序排序）。订单页已有完整的「status 白名单筛选 + 真分页」链路先例：网关 `list_orders`（payments.py:165-229）、repo `OrderRepo.find_by_user_page`（payments_repo.py:107-146，pg_http 单往返 want_count=True + Content-Range 缺失降级、sqlite 装载全量 len+切片）。前端订单页（OrdersPage.vue）已有 tab 分版全套交互实现。设计事实源：docs/design-s/prototypes/license.html（2026-09-03 tab 分版修订版）+ ADJUSTMENTS.md 同日四条登记；三轮架构评审记录在案并放行。

## Goals / Non-Goals

**Goals:**
- 套餐明细链路（接口→repo→前端）与订单页逐字同构，交互零学习成本
- 清掉 license 响应体无界增长的债
- 页面级判定单源化（grant_count）

**Non-Goals:**
- 不做部署 compat 窗口（用户裁定：线上无用户，单阶段直接切）
- 不动 `/api/pay/membership` 过渡别名（其复用 license handler，随瘦身自动一致）
- 不修订单页 tab 的 ARIA 缺陷（记技术债，另立小项）；不做方向键 tab 导航
- 不动 hero 的 `find_all_by_username` 全量加载 merge（个人量级成立；未来 repo 级 MAX 聚合另议）
- 不新增排序计算列

## Decisions

- **D1 路由 `GET /api/pay/license/grants`，不用 `/api/pay/grants`**：域对象是 License 聚合，明细行是子资源；`/pay/grants` 是已被裁定迁移废弃的旧 URI 词根（s-payments spec 保留 `POST /api/pay/grants/activate` 仅作 legacy 别名），不得复活。参数名用 `status`（单数、逗号分隔）逐字镜像订单模式——保持「哑接口」单源，未来加组不动契约。
- **D2 hero 加 `grant_count`，不用订单式探测**：`pending_count` 已是跨全量明细的计数标量，`grant_count` 是同族第二个；订单探测存在是因为订单无聚合接口且每次切 tab 重发，而「tab 条可见性/整页空态」是页面级事实不随 tab 变，pg_http 探测是真网络往返。后端零新增查询（license handler 本就装载全量码做 merge，顺手 len()）。口径钉死：只数 `source='order'`，与「全部」total 同过滤器。
- **D3 排序下推 DB 为 `created_at desc`，弃状态分组序**：pg_http 客户端 sort 只支持 `列.方向`，表达不了 SQL CASE；加计算列属过度设计。用户可感知变更（「全部」不再状态分块、已收回不沉底），已在 spec delta 显式裁定，置灰成为已收回行唯一视觉线索。
- **D4 repo 返回域对象 `ActivationCode`**（保持 CodeRepo 惯例，parse_dt 已归一），勿学 OrderRepo 返回裸 dict。pg 侧 `source=eq.order` 天然排除 NULL 行，与网关侧 `getattr(c,'source','admin')=='order'` 语义一致；sqlite 侧 `row.source or "admin"` 同口径。ISO 串字典序时间排序 orders 已在跑，可信。
- **D5 前端照抄 OrdersPage 骨架**：双 watch（query 还原 + activeTab→fetchPage；一轮评审「单 watch」结论随服务端化作废）、tabToken 会话令牌、refreshing 置灰、按 code_id 去重追加、首载 hero+默认 tab 并行（Promise.all）。`.seg` 已在 base.css 全局（:131-134），LicensePage 直接用。三层判定单源：tab 条=grant_count>0；整页空态=grant_count===0&&remaining_sec<=0；手工码态=grant_count===0&&remaining_sec>0（旧后端 `?? 0` 安全退化）。
- **D6 激活刷新收敛单入口 `postActivateRefresh()`**：`reload()` hero + 仅当 activeTab 为待激活时 `switchTab('all')`，否则 `fetchPage(true)`——三个都无脑调会同 tab 双请求（switchTab 的 watch 已触发 fetchPage）。「全部」版内直接激活同样走此函数（行在版内 pending→active，必须重拉）。
- **D7 单阶段部署**：用户裁定线上无用户，前后端同批上线，grants 字段直接删，不做三阶段 compat 窗口。

## Risks / Trade-offs

- [单阶段切换：若前后端部署间隔内真有用户访问旧前端] → 明细不可见+console 报错（激活入口在 hero 的待激活计数仍在但行按钮消失）；用户已接受（线上无用户）。回滚=revert 部署包。
- [OFFSET 分页在并发变更下重复/跳行] → 按 code_id 去重兜住重复，跳行可接受；与订单页同级对齐。
- [漏改散落的 grants 断言致 CI 红] → 已穷举：test_payments_api.py:281-356 三用例 + **test_jwt_uid_claim.py:100（范围外漏网点）** + e2e api-handlers.ts mock 组装；任务清单逐条列出。
- [「全部」版行序变化引起老用户困惑] → 无线上用户，不成立；spec 已显式裁定。

## Migration Plan

单 PR：后端（handler+repo+测试）与前端（api+页面+e2e）同批合并，push main 自动部署两条流水线（顺序无谓）。回滚=revert。

## Open Questions

（无——三轮评审已全部收敛。）
