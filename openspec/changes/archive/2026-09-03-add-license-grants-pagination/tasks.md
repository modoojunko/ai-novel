# Tasks: add-license-grants-pagination

## 1. 后端 repo 层（明细分页查询）

- [x] 1.1 `server/app/infrastructure/repositories/base.py`：CodeRepo Protocol 增 `find_order_grants_page(user_id, statuses, limit, offset) -> (rows, total)`，verify=venv python `-c "import app"` 通过
- [x] 1.2 `server/app/infrastructure/repositories/sql/code_repo.py`：sqlite 实现——装载该用户全量码后按 `source=='order'`（`row.source or "admin"` 折算）+ 可选 status 过滤，len()+切片，镜像 payments_repo.py:132-139；verify=单测 1.4
- [x] 1.3 `server/app/infrastructure/repositories/pg_http/code_repo.py`：pg 实现——`find(want_count=True)` 单往返（Prefer: count=exact，Content-Range 尾段取 total，网关不回头降级单独计数），filter=`source=eq.order` + 可选 `status=in.(...)`，sort=created_at desc，镜像 payments_repo.py:135-146；verify=单测 1.4
- [x] 1.4 repo 层测试：过滤/分页/total/手工码排除/历史 NULL source 行不进明细（sqlite 与 pg_http 契约各跑一遍）；verify=pytest 绿

## 2. 后端网关层（瘦身 + 新端点）

- [x] 2.1 `server/app/interfaces/web_api/payments.py`：新增 `GET /license/grants` handler——status 逗号白名单 `{pending_activation, active, revoked}`（未知值忽略、全未知=空列表+0）、page/page_size 默认 20 上限 100、响应 `{items, total}`、行结构=原 grants 行逐字（保留 order_no join 富化），镜像 list_orders payments.py:165-229；verify=pytest 新端点用例
- [x] 2.2 同文件：`GET /license` handler 瘦身——响应增 `grant_count`（all_codes 派生，只数 source='order'）、删 grants 内嵌组装（:483-499 的 source 过滤/order_no join/_status_order 排序随迁移搬入新 handler）；`/api/pay/membership` 别名自动随 handler 一致，不动；verify=pytest
- [x] 2.3 `server/tests/test_payments_api.py`：grants 断言（:281-356 TestLicenseGrants）迁移——license 响应改断言 grant_count 与无 grants 键；新增新端点用例（白名单/未知值回落/分页钳制/total/未登录 4001/手工码排除）；verify=pytest 全绿
- [x] 2.4 `server/tests/test_jwt_uid_claim.py:100`：`grants == []` 断言改 `grant_count == 0`（范围外漏网点，漏改合并即红）；verify=grep 全仓无残余 `data.*grants` 消费 + pytest 全绿

## 3. 前端 api 客户端

- [x] 3.1 `server/frontend/src/api/pay.ts`：LicenseView 增 `grant_count: number`、grants 字段删除；新增 `LICENSE_TABS`（all/active/pending_activation/revoked）/`LicenseTabKey`/`DEFAULT_LICENSE_TAB='active'`/`licenseTabFromQuery`/`LicenseGrantPage`/`apiPayLicenseGrants(page, pageSize, statuses?)`，镜像 :141-157 与 apiPayOrders 模式；verify=npm run build 或 vue-tsc --noEmit 绿

## 4. 前端页面改造（LicensePage 订单化）

- [x] 4.1 tab 骨架：四版 `.seg` tab 条（role=tablist，按钮 role=tab + :aria-selected，列表 role=tabpanel）、`?tab=` 双 watch 同步（默认版省参、replace 带展开、非法回落）、每版独立分页状态 + tabToken + refreshing 置灰；verify=e2e 4.4
- [x] 4.2 列表与分页：行渲染沿用现结构（tier·时长/状态 pill/关键时间/待激活激活按钮）、「已显示 X 笔 · 共 Y 笔」+「加载更多」（按 code_id 去重、无下一页不显示按钮）、失败保留旧列表；已收回行置灰规则=`status==='revoked' && activeTab==='all'`；verify=e2e
- [x] 4.3 三层判定 + 激活刷新：tab 条=grant_count>0；整页空态=grant_count===0&&remaining_sec<=0（tab 条不渲染）；手工码态=grant_count===0&&remaining_sec>0（仅档位头）；激活成功 `postActivateRefresh()` 单入口（reload hero + 待激活版才 switchTab('all')，否则 fetchPage(true)），不可激活错误出路提示不动；verify=e2e
- [x] 4.4 `server/frontend/e2e/mocks/api-handlers.ts` + `server/frontend/e2e/tests/license.spec.ts`：mock 改 license 瘦身结构（grant_count）+ `/pay/license/grants` 拦截（带 status query 的 glob 补 `*`）；用例=默认版生效中且 URL 省参/四 tab 过滤/加载更多去重/非法 tab 回落/某类空+切回全部/整页空态无 tab 条/手工码态/旧后端退化（无 grant_count）/激活后切全部且 hero 刷新；verify=本机 playwright 全绿

## 5. 门禁与收尾

- [x] 5.1 后端全量 pytest + 前端 vue-tsc --noEmit + 本机 S端 e2e 全量；verify=全绿
- [x] 5.2 合并 push main 部署，线上验证：`/api/pay/license` 返回 grant_count 无 grants、`/api/pay/license/grants` 各筛选 200、我的套餐页四 tab 实测（本机 tcb 部署兜底路线备用）；verify=curl/线上实测记录
- [x] 5.3 归档（用户口令触发）：sync 两 capability spec、ADJUSTMENTS.md 补「已实现」行、按规则产出归档知识总结（~/Desktop/knowledge/ + 记忆索引）
