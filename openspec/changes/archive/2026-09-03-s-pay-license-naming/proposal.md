## Why

`membership` 是域外词：`GET /api/pay/membership` 返回的是域对象 `License` 的聚合视图（`License.merge(codes)` 算出 tier/max_expires_at），URI 与代码符号和实存对象名错位。按本体论纪律（一物一名、资源名取自实存域对象），该资源在本体论上的名字就是 license。设计文档 `backend-detail-design.md:1634` 自注"路径定 membership（前端版为准）"——是历史偶然而非对象事实。消费面已核实极小：仅 S端 web 控制台自调，C端零引用，前后端同仓同发，改名成本处于最低点。

## What Changes

- **BREAKING**（同仓同发+后端过渡别名兜底，对外无第三方消费者）：`GET /api/pay/membership` → `GET /api/pay/license`；后端函数 `get_membership` → `get_license`；**响应体字段与口径零变化**（tier/remaining_sec/remaining_desc/max_expires_at/pending_count，本就无 membership 字样）
- 后端过渡别名：`/api/pay/membership` 与 `/api/pay/license` 同注册一 decorator 双路径，防前后端部署窗口期 404；验证线上前端包零引用后删除（本 change 收尾任务）
- 前端符号与路由对齐：`MembershipView`→`LicenseView`、`apiPayMembership`→`apiPayLicense`、`MembershipPage.vue`→`LicensePage.vue`（scoped 类 `membership-page`→`license-page`）、路由 `path/name: membership`→`license`（`/dashboard/license`）
- 兼容重定向反转：新增 `/dashboard/membership` → `/dashboard/license`（接住上线后老书签）；原"激活码老链接"规则 `license→membership` 由真身页取代——老激活码书签直接落到权益页，语义连续，redirect 链不增长
- 测试同批：`test_payments_api.py`、`test_timezone_discipline.py` 换路径；`e2e/mocks/api-handlers.ts` mock 路由与状态字段更名；`license-redirect.spec.ts` 断言反转为 membership→license
- 设计事实源同批防再错位：`docs/design-s/prototypes/membership.html` 更名 `license.html` 并更新全部引用（console.html/storymap/ADJUSTMENTS/README）；`backend-detail-design.md`、`frontend-detail-design.md` 中 membership 表述同步 license

**非目标**（另立 change，不混入）：
- 激活链一物三名收敛（域对象叫 `code` / URI 动作叫 `grant` / 应用服务叫 `entitlement`）
- UI 文案"我的套餐"保留不改（URI 认对象，文案认人）
- openspec 归档目录中的历史 membership 记录不改（历史事实）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `s-payments`: 新增「License 总览接口命名对齐域对象」requirement——资源 URI 与代码符号必须取自实存域对象名（license），并规定旧路径过渡别名与旧页面链接重定向行为

## Impact

- **后端**：`server/app/interfaces/web_api/payments.py`（路由+函数名）；`server/tests/test_payments_api.py`、`server/tests/test_timezone_discipline.py`
- **前端**：`server/frontend/src/router/index.ts`、`src/api/pay.ts`、`src/views/dashboard/MembershipPage.vue`（更名）、`DashboardHome.vue`、`DashboardLayout.vue`、`views/pay/OrderDetailPage.vue`、`views/pay/CashierPage.vue`；e2e `mocks/api-handlers.ts`、`tests/license-redirect.spec.ts`
- **文档**：`docs/design-s/backend-detail-design.md`、`frontend-detail-design.md`、`prototypes/membership.html`（更名）及其引用
- **API 消费方**：仅 S端 控制台自身（09-02 grep 证实 C端 client/ 零引用）；无外部集成方
- **部署**：push main 触发后端（novel-s-server）自动部署；前端（novel-s-web）随后上传——双路径别名覆盖窗口期

## Design Impact

- 受影响端：**S端**（C端零涉及）
- 受影响屏/入口清单：我的套餐页（`/dashboard/membership`→`/dashboard/license`，仅路径/文件名/符号变更，**视觉与文案零变化**）；DashboardLayout 导航链接、DashboardHome 查看明细按钮、OrderDetailPage"去我的套餐"、CashierPage"立即激活"共 3 页 4 处跳转目标 URL
- 对象状态：无新增/修改状态，沿用现有 pill 语气词（info/ok/warn/err）
- 共享段：不触碰 base.css 令牌与基础组件类
- 原型先行：免（纯路径/符号改名，零视觉变化）；设计事实源同批更名防词汇再入侵，附改前后同屏截图对照（预期逐像素一致），实现侧自查产出
- 文案：零新增文案，无需 §13 口径审查
