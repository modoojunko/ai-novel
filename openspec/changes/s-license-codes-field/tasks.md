## 1. 双端影响判定（原型先行的替代任务）

- [x] 1.1 判定本改动为纯 S端 且不触共享段（依据=proposal「Design Impact」：纯字段/符号/CSS 类名改名，零视觉/文案变化；C端 桌面 client/ 零引用已 grep 证实），原型先行豁免

## 2. 后端

- [x] 2.1 `web_api/payments.py`：`GET /license/grants`→`GET /license/codes`（旧路径别名 decorator）；`list_license_grants`→`list_license_codes`；`_LIST_GRANT_STATUSES`→`_LIST_CODE_STATUSES`；总览 `grant_count`→`code_count` 并双发旧键；订单详情快照 `"grant"`→`"fulfillment"` 并双发旧键；验证=✅ 25 passed
- [x] 2.2 仓储方法更名：`repositories/base.py`、`repositories/pg_http/code_repo.py`、`repositories/sql/code_repo.py` 三处 `find_order_grants_page`→`find_order_codes_page`；验证=✅ grep 清零；全量 pytest 312 passed
- [x] 2.3 测试换路径/字段：`test_payments_api.py`（license/grants×5、grant_count×1、订单快照断言）、`test_jwt_uid_claim.py`（grant_count×1）；新增双发断言（license 响应含 code_count+grant_count 同值、订单详情含 fulfillment+grant 同内容）；验证=✅ 312 passed（含新增双发断言）

## 3. 前端（server/frontend）

- [x] 3.1 `src/api/pay.ts`：`LicenseGrant`→`LicenseCode`、`LicenseGrantPage`→`LicenseCodePage`、`apiPayLicenseGrants`→`apiPayLicenseCodes`（URL `/pay/license/codes`）、`OrderGrant`→`OrderCode`、订单详情类型 `grant?`→`fulfillment?`；删除 `LicenseView.grants?` 死字段；验证=✅ exit 0；grep src/e2e grant 残余=0（grant_start 与归档 change 名除外）
- [x] 3.2 `src/views/dashboard/LicensePage.vue`：导入/类型/函数名/注释同步，CSS 类 `grant-row`→`code-row`；`src/views/pay/OrderDetailPage.vue`：`o.grant`→`o.fulfillment`；
- [x] 3.3 e2e 同批：`mocks/api-handlers.ts`（TestLicenseGrant→TestLicenseCode、licenseGrants 内部字段、路由串 license/codes、TestOrder.grant→fulfillment、TestLicense.grant_count→code_count）、`tests/license.spec.ts`（locator `.code-row`、字段名）；验证=✅ 154 passed (1.3m)

## 4. 设计事实源（docs/design-s）

- [x] 4.1 `backend-detail-design.md`：附录 Z 总览行（grant_count→code_count 双发注）、分页端点行（license/codes）、订单详情 grant 行（fulfillment 双发注）、§4.12/明细段落 grant 表述；验证=✅ 附录 Z 补分页/计数两行（原缺失，顺手补齐文档漂移）；旧名仅历史表述
- [x] 4.2 `frontend-detail-design.md`：分页段落（apiPayLicenseGrants/LicenseGrantPage/URL）与 e2e 清单行；验证=同上

## 5. 回归与上线验证

- [x] 5.1 门禁全跑并记录结论：`vue-tsc --noEmit` / 全量 `pytest` / `design:lint`（存量口径同前）；实测：vue-tsc exit 0；全量 pytest 312 passed；playwright 154 passed；design:lint 存量口径不变
- [x] 5.2 残余 grep 验收：全 worktree（排除归档/venv/node_modules/.mimosa/本 change 工件）`license/grants`、`grant_count`、`LicenseGrant`、`find_order_grants_page`、`grant-row` 残余=后端别名/双发行 + 收尾前过渡表述；实测：代码残余=后端别名/双发行（470-492/501/630 区）+ license.spec describe 标题引用归档 change 名 license-grants-pagination（专名词）+ backend-detail 事件键 codes:{id}:granted 与 device_grants（已落库幂等键/device 域，裁定保留记账）
- [ ] 5.3 上线验证（合并 → 自动部署后）：`GET /api/pay/license` 未登录 4001 且登录口径双计数键同值（pytest 兜底）、`GET /api/pay/license/codes` 与旧路径行为一致、订单详情双快照键；前端线上包核验旧键/旧路径零引用；验证=实测记录
- [ ] 5.4 收尾小 PR：删旧路径别名与 grant_count/grant 旧键 → 全量 pytest 绿 → 合并部署复验终态（codes 200/旧路径 404、单键）；验证=终态记录

## 6. 归档

- [ ] 6.1 openspec sync + 归档走 PR（--admin 纯文档）；验证=归档后 s-payments 含 MODIFIED/ADDED requirement、changes 列表无本 change
