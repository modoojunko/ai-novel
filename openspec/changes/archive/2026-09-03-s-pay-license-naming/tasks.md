## 1. 双端影响判定（原型先行的替代任务）

- [x] 1.1 判定本改动为纯 S端 且不触两端共享段（判定依据=proposal「Design Impact」：零视觉/文案变化、仅路径与符号改名），原型先行豁免；设计事实源更名改在 §4 与实现同批落地，验证=判定结论记入本条勾选备注

## 2. 后端

- [x] 2.1 `server/app/interfaces/web_api/payments.py`：`get_membership` 更名 `get_license`，路由改 `@r.get("/license")` 并叠加 `@r.get("/membership")` 过渡别名（同函数双 decorator，注释注明删除判据），docstring"Z.6 我的套餐总览"保留；验证=✅ `pytest tests/test_payments_api.py tests/test_timezone_discipline.py -q` → **26 passed**（主分支已进至 2c526a1，membership 端点含 grants 明细，alias 同体覆盖它）
- [x] 2.2 测试换路径：`test_payments_api.py` 4 处请求改 `/api/pay/license`；`test_timezone_discipline.py` `test_membership_remaining`→`test_license_remaining` 并换路径；`TestMembershipGrants`→`TestLicenseGrants`；新增 `test_membership_alias_matches_license`（两路径返回体逐字段相等）；验证=✅ 全量 `pytest -q` → **291 passed**

## 3. 前端（server/frontend）

- [x] 3.1 `src/api/pay.ts`：`MembershipView`→`LicenseView`、`MembershipGrant`→`LicenseGrant`、`apiPayMembership`→`apiPayLicense`、URL 改 `'/pay/license'`；验证=✅ `npx vue-tsc --noEmit` exit 0（消费方符号错误清零）
- [x] 3.2 `src/views/dashboard/MembershipPage.vue` → `LicensePage.vue`（git mv）：scoped 类 `membership-page`→`license-page`、头部设计事实源注释指向 `prototypes/license.html`、`console.error` 前缀同步；验证=✅ vue-tsc 绿 + e2e license.spec 页面可路由
- [x] 3.3 `src/router/index.ts`：`path/name: 'license'` 挂真身页组件；新增 `{ path: 'membership', redirect: { name: 'license' } }`；删除原 `license→membership` 重定向规则；验证=✅ license-redirect.spec 断言反转后绿
- [x] 3.4 消费面链接与符号：`DashboardLayout.vue` 导航 href、`DashboardHome.vue`（`membership` ref→`license`、`membershipStatusPill`→`licenseStatusPill`、按钮跳转、类型/函数引用）、`OrderDetailPage.vue`、`CashierPage.vue` 跳转改 `/dashboard/license`；验证=✅ grep `src/` membership 清零（仅 redirect 注释与规则行）
- [x] 3.5 e2e 同批：`e2e/mocks/api-handlers.ts`（mock 路由串 `/api/pay/license`、`TestMembership*`→`TestLicense*`、`setMembership`→`setLicense`、`syncMembershipFromGrants`→`syncLicenseFromGrants`）、`e2e/tests/license-redirect.spec.ts` 断言反转、`membership.spec.ts`→`license.spec.ts`（tasks 未列、#275 新增的整页 spec，同批更名）、`dashboard-home.spec.ts` setter 引用；验证=✅ 本地全量 playwright → **151 passed (24.6s)**（5175 strictPort）

## 4. 设计事实源（docs/design-s）

- [x] 4.1 `prototypes/membership.html` → `license.html`（git mv 保历史）并在 `prototypes/ADJUSTMENTS.md` 登记更名条目（更名原因：本体论对齐域对象 License）；验证=✅ 文件存在 + 2026-09-03 更名条目在册
- [x] 4.2 引用同批更新：`console.html` 注释、`backend-detail-design.md` API 表行 + Z.6 DTO 标题（MembershipView→LicenseView）、`frontend-detail-design.md`（路由表/迁移注/页面名/组件与符号名 19 处）、`account-settings-design.md` 归属页；验证=✅ `grep -rn membership docs/design-s/` 仅剩 ADJUSTMENTS 历史台账行与"过渡别名/旧路径"说明性表述，无活引用（storymap.html/README 实际无引用）

## 5. 回归与上线验证

- [x] 5.1 门禁全跑并记录结论：`npx vue-tsc --noEmit` → **exit 0**；后端全量 `pytest -q` → **291 passed (8.42s)**；`npm run design:lint` → **存量红 1 项**：`src/constants/site-beian.ts:1 [emoji]`（主目录同报，与本改动无关，本次零视觉/样式文件改动）；`ruff check` 改动 py 文件 → 2 处（payments.py I001 / test F401）**主目录同报存量**，非本次引入
- [x] 5.2 残余 grep 验收：全 worktree grep（排除 node_modules/.venv/.git/.mimosa/openspec 归档）→ 代码残余=payments.py 别名 decorator 一行 + router redirect 规则 + license-redirect.spec 旧路径断言（测试对象即旧路径）+ 别名一致性测试，docs/design-s 残余=过渡说明与历史台账；符合"仅剩后端过渡别名一处"的 spec 口径（redirect 与别名测试为该口径的必要伴随）
- [x] 5.3 上线验证三连（合并 → 后端自动部署 → 前端 novel-s-web 上传后）：`GET /api/pay/license` 200、`GET /api/pay/membership` 200 且返回体与前者一致、浏览器访问 `/dashboard/membership` 落到 `/dashboard/license` 且页面渲染正常；实测：✅ GET /api/pay/license 200（未登录口径）；✅ 窗口期 GET /api/pay/membership 200 与前者同口径；✅ 浏览器实测 /dashboard/membership → 路由重定向 → /login?redirect=/dashboard/license（未登录守卫携带的已是新路径，登录后直落新页）
- [x] 5.4 收尾小 PR：线上前端 bundle `grep '/pay/membership'`=0 判据成立后，删 payments.py 别名 decorator → 全量 pytest 绿 → 合并部署后复验 `GET /api/pay/license` 200；实测（PR #286 合并部署后）：✅ 线上 bundle /pay/membership=0（pay.MR9HuHMb.js/LicensePage.BAssANc1.js/DashboardLayout 均实测）；✅ 终态 GET /api/pay/license 200、GET /api/pay/membership 404

## 6. 归档

- [ ] 6.1 openspec sync + 归档走 PR（既有纪律：--admin 纯文档 PR 可直合，openspec 目录不整目录 git add）；验证=归档后 `openspec list` 无本 change、specs/s-payments 含新 requirement
