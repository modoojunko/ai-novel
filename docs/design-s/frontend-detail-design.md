# S端 扫码支付 · 前端详细设计（Change 1「支付地基」）

> 状态：**前端详细设计稿，待人工评审**。评审通过后按 openspec 流程拆任务（建议 change：`s-wxpay-native`）。
> 本文是设计文档，不是实现；但组件 API / 状态 / 路由 / 文案已具体到可直接照写代码。
>
> 事实源与阅读顺序（本文所有口径以这六处为准，冲突时按此序裁定）：
> 1. `docs/prd/s-payment-explore.md`（业务口径唯一事实源）
> 2. `docs/design-s/prototypes/` 八个原型 HTML + `ADJUSTMENTS.md`（像素与词汇事实源）
> 3. `server/frontend/src/`（Vue 3 + Pinia 现有结构）
> 4. `server/frontend/e2e/`（现有 e2e 模式）
> 5. `server/frontend/scripts/design-vocab.mjs`（词汇 lint 白名单）
> 6. `docs/ux/cross-end.html` §四（跨框架分工：Vue 壳保留、类名契约一致）

---

## 目录

- [0. 范围与硬约束](#0-范围与硬约束)
- [1. 现有地基盘点（嫁接点）](#1-现有地基盘点嫁接点)
- [2. 路由与信息架构](#2-路由与信息架构)
- [3. 组件设计](#3-组件设计)
- [4. API 层](#4-api-层)
- [5. 状态管理（Pinia）](#5-状态管理pinia)
- [6. C端 到期提示条（唯一 C端 改动）](#6-c端-到期提示条唯一-c端-改动)
- [7. 文案表（实现单一来源）](#7-文案表实现单一来源)
- [8. 设计令牌与词汇纪律](#8-设计令牌与词汇纪律)
- [9. e2e 设计](#9-e2e-设计)
- [10. 性能与可访问性](#10-性能与可访问性)
- [11. Open Questions](#11-open-questions)

---

## 0. 范围与硬约束

### 0.1 范围

**做**：Change 1「支付地基」的 S端 前端全部界面 + C端 到期提示条：

- 购买收银台流程页（选套餐 → 协议弹窗 → 扫码轮询 → 到货/失败/过期终态，共 8 个态）
- 控制台改版：首页（横幅+四卡）、我的套餐（时间线+待激活）、我的订单（六状态行+空态）、订单详情（六态全量信息+流程时间线+状态操作聚合）、申请退款流、我的设备（额度头+解绑确认）
- 现网「激活新码」功能整体拆除（激活码人工渠道丢弃，PRD 决策 8.5）
- C端：check-auth 响应扩展字段 + 到期/退款/核对中提示条

**不做**：

- 发票功能整体暂缓（PRD 决策 8，2026-08-29 拍板）：不实现「获取发票」按钮、开票申请弹层、订单详情发票区、发票详情页（invoice.html）。设计在本文件 §3.8 保留占位说明（将来恢复点），实现时订单详情 `ops` 数组不出现发票项。
- JSAPI/H5 支付（手机端打开购买页仅提示「请在电脑端完成支付」，PRD §九）。
- 管理面（ADMIN_TOKEN API + MCP，无 Web 管理页）。

### 0.2 硬约束（每条都来自任务书或事实源）

| # | 约束 | 出处 |
| --- | --- | --- |
| H1 | Vue 3 组合式 API + `<script setup>` + TS；不引入新 UI 库 | 任务书 |
| H2 | 发票暂缓：按钮/弹层/发票区不做，设计留占位 | PRD 决策 8 |
| H3 | 原型是像素与词汇事实源：类名结构照抄原型（reviewer 对照 ADJUSTMENTS） | 任务书 |
| H4 | 金额一律 `¥xx.xx` + `.num`；时间一律北京时间展示 | 任务书 / PRD §11 |
| H5 | e2e 不依赖真实后端（全 mock，沿用 fixtures auto 模式） | 任务书 |
| H6 | 颜色/字体/圆角只用 base.css 既有 var；新组件不造新 CSS 视觉档位 | 任务书 / cross-end §四 |
| H7 | 词汇：pill/notice 体系；无 success/danger 措辞（用 ok/warn/err）；PRO 仅作档名，禁作「付费」同义词 | PRD §一·五 / cross-end §3.2 |
| H8 | C端 零购买动作：购买/协议/支付/激活/退款全在 S端，C端 只跳转 | storymap 红线 |
| H9 | 「激活」作为动词可用（解禁套餐），「激活码」界面入口全拆 | PRD 决策 3 / 8.5 |

---

## 1. 现有地基盘点（嫁接点）

| 现有资产 | 路径 | 复用方式 |
| --- | --- | --- |
| 路由（懒加载+双向守卫） | `src/router/index.ts` | 扩展：新流程页路由段 + 控制台子路由改名/新增（§2） |
| axios 封装（token 注入 / code!=0 reject / 401 硬跳 / 冷启动预热门闩） | `src/api/request.ts` | 原样复用；新增 `api/pay.ts` 走同一实例 |
| API 模块样板 | `src/api/web.ts` | 新增 `api/pay.ts` 按同款函数式签名 |
| session store（login/register/fetchUserInfo/applyTheme） | `src/stores/session.ts` | 复用 login；扩展 tier 语义与到期信息（§5.3，OQ5） |
| devices store（fetchDevices/removeDevice，active_limit） | `src/stores/devices.ts` | 原样复用，设备页换壳（§3.7） |
| usePageLoad（loadError+retry 样板） | `src/composables/usePageLoad.ts` | 新页面统一使用 |
| useToast / toast store | `src/composables/useToast.ts` | 全局提示统一走它（禁 alert） |
| AppButton（variant/size/loading/block/to/href） | `src/components/ui/AppButton.vue` | 复用；variant 词表 primary/secondary/ghost/error/link |
| AppModal（scrim/modal/mcard、Esc、Tab 焦点圈、焦点还原、Teleport） | `src/components/ui/AppModal.vue` | 复用；补一处滚动锁定（§10.3） |
| AppCard（panel+hoverable/hl/compact）、AppInput、EmptyState、LoadingSkeleton、Ico/icons | `src/components/ui/*` | 复用 |
| DashboardLayout（appbar+nav+tier pill） | `src/layouts/DashboardLayout.vue` | 改版：导航 5 项改名（§2.2） |
| design/base.css（@cross 共享段 + S端 本地段：.panel 家族/.notice 四语气/.btn-lg 等） | `src/design/base.css` | 视觉只用其中类与 var；新布局工具类入 S端 本地 css（§8.2） |
| e2e fixtures（auto mockApi）+ MockApi（兜底拦截+精确路由表） | `e2e/fixtures.ts`、`e2e/mocks/api-handlers.ts` | 扩展 pay 路由与状态机 mock（§9） |
| design:lint（src 全量严格） | `scripts/design-lint.mjs` + `design-vocab.mjs` | 新代码必须过（§8.4） |

**拆除清单**（激活码渠道丢弃的连带）：

- `src/components/dashboard/ActivateCodeForm.vue`（删除）
- `DashboardHome.vue` / `LicensePage.vue` 中的激活码 modal 与入口（重写时自然消失）
- 路由 `/dashboard/license` → 迁移为 `/dashboard/membership`，旧路径 301 redirect（防外链/书签失效）

---

## 2. 路由与信息架构

### 2.1 路由表（新增/变更全集）

```
src/router/index.ts 路由树（★新增 ◎改版 →重定向）
├── /                      PublicLayout（不动）
│   ├── ''                 landing（不动）
│   ├── login              guestOnly（不动；收银台不用它，见 §2.3）
│   └── register           guestOnly（不动；支持 ?redirect= 回跳透传）
├── /auth                  AuthLayout（不动）
├── /pay                   ★ PayLayout（流程页外壳，无 appbar/nav，无 requiresAuth）
│   ├── ''                 ★ name=checkout        CheckoutPage（选套餐 + 未登录登录卡 + 恢复横幅）
│   └── order/:orderNo     ★ name=order-pay       OrderPayPage（waiting/paid/closed/failVerify 终态面板）
├── /dashboard             DashboardLayout（requiresAuth，改版导航）
│   ├── ''                 ◎ name=dashboard       DashboardHome（横幅+四卡）
│   ├── membership         ★ name=membership      MembershipPage（我的套餐）
│   ├── orders             ★ name=orders          OrdersPage（我的订单）
│   ├── orders/:orderNo    ★ name=order-detail    OrderDetailPage（六态详情）
│   ├── orders/:orderNo/refund ★ name=refund     RefundPage（申请退款流）
│   ├── devices            ◎ name=devices         DevicesPage（额度头+解绑确认）
│   └── account            （不动）
│   └── license            → redirect { name: 'membership' }（旧路径兼容一个版本期后删）
└── /*                     NotFound（不动）
```

要点：

- **收银台是独立流程页**：`/pay` 挂在新 `PayLayout` 下，**不带** DashboardLayout 的 appbar/导航（cashier.html 选型 A：居中品牌头 + 左上 `‹ 返回控制台` 固定链接）。`/pay` **不加 `requiresAuth`**——未登录是收银台八态之一的「态〇 登录卡」（§3.1.1），不是路由级跳转。
- **订单号写进 URL**（PRD §7「页面刷新/换设备」行）：`/pay/order/:orderNo` 在任何设备重开即恢复轮询/终态展示；`:orderNo` 形如 `S20260829-7F3K`（含随机段防遍历，PRD B4）。
- **退款流在控制台外壳内**（refund.html 带 appbar、导航高亮「我的订单」）：作为订单详情的子路径 `/dashboard/orders/:orderNo/refund`，从订单详情「申请退款」进入。
- 订单详情是控制台页（order-detail.html 带 appbar），与收银台终态页（cashier.html paid/closed 态）**不是同一屏**：收银台终态聚焦「这一单刚发生什么+立即激活」，订单详情是「信息全量+操作聚合」。

### 2.2 外壳改版：DashboardLayout

导航由 4 项改为 5 项（console.html IA 终版）：

```
首页 · 我的套餐 · 我的订单 · 我的设备 · 我的账户
/dashboard  /dashboard/membership  /dashboard/orders  /dashboard/devices  /dashboard/account
```

- 各页 `<router-link active-class="on">`，首页用 `exact-active-class="on"`（现状模式照抄）。
- 右上 tier pill 保留（`session.tierDisplay`），显示口径随 tier 语义重构调整（OQ5）。
- 「购买」不占导航：收银台是流程页，仅有页面内入口（storymap：流程页仅返回入口）。

### 2.3 登录拦截与回跳（收银台未登录态）

**设计裁定：收银台不用全局守卫跳 `/login`，用页内登录卡**（cashier.html 态〇）：

1. C端/外链以系统浏览器打开 `/pay?sku=pro-yearly`（sku 可选参数，C端 功能墙/到期条带入）。
2. `CheckoutPage` 挂载：`session.isLoggedIn` 为 false → 渲染「登录后继续购买」态：h1 + 副题「PRO · 包年（365 天）· ¥292.00 —— 您的选择已保留」（选择来自 query `sku`，无 sku 时显示「登录后继续购买」无摘要形态）+ 登录卡（AppInput 用户名/密码 + `登录并继续购买` 主按钮 + 「注册即送 7 天全功能试用 · 忘记密码」链接）。
3. 登录走 `session.login()`（复用，含冷启动门闩）；成功后**原地**切到 pick 态，选择不丢。
4. 注册链接 → `/register?redirect=/pay?sku=pro-yearly`（注册即登录态，回跳继续）；「忘记密码」→ 既有找回流程；「‹ 暂不购买，先逛逛」→ `/`（落地页）。
5. **已登录用户访问 `/pay`** 正常进 pick 态（不加 guestOnly）。
6. **会话中途失效**（token 过期，拦截器 `handleUnauthorized` 硬跳 `/login`）：维持现有全局行为，`redirect` query 带回 `/pay...` 或 `/pay/order/:orderNo`，登录后回跳可恢复（轮询页靠 URL 订单号）。不为收银台单独改 `handleUnauthorized`（避免全局回归风险）。

**控制台侧**：`/dashboard/**` 维持 `requiresAuth` 正向守卫（含新增 orders/membership 子路由），未登录 → `/login?redirect=…`（guards.spec.ts 补用例）。

### 2.4 入口/去向对应表（storymap ↔ 路由）

| storymap 入口 | 触发元素 | 去向 |
| --- | --- | --- |
| C端 · 功能墙「升级」 | UpgradeModal 确认升级 | 系统浏览器打开 `S端/pay`（H8：C端 无购买界面） |
| C端 · 到期提醒条 | 提示条「去续费」（§6） | 系统浏览器打开 `S端/pay` |
| 控制台首页 | page-head「续费或购买时长」/ 试用卡「购买套餐」 | `/pay` |
| 我的套餐 | page-head「续费或购买时长」/ 免费态「去购买套餐」 | `/pay` |
| 我的订单 · 空态 | 「去购买套餐」 | `/pay` |
| 收银台各终态出口 | 「返回控制台」「重新下单」「返回重选」「重试」 | `/dashboard` / `/pay`（保留选区）/ `/pay` |
| 已到货页「先存着」 | 次链接 | `/dashboard/membership` |
| 已到货页「立即激活」 | 主按钮 | 原地反馈（激活后仍停在本页显示已生效，提供「返回控制台」） |
| 订单行「详情 ›」 | 链接 | `/dashboard/orders/:orderNo` |
| 订单详情「申请退款」 | 按钮 | `/dashboard/orders/:orderNo/refund` |
| 订单详情「继续支付」（waiting 态） | 主按钮 | `/pay/order/:orderNo` |
| 订单详情「去我的套餐」 | 主按钮 | `/dashboard/membership` |
| 订单详情「再来一单 / 重新下单」 | 按钮 | `/pay?sku={order.sku_id}`（带上原 sku 预选） |

---

## 3. 组件设计

### 3.0 复用清单 vs 新建清单

**复用（不改或微调）**：AppButton / AppModal / AppCard / AppInput / EmptyState / LoadingSkeleton / Ico+icons / useToast / usePageLoad / SiteBeianBar / DownloadModal（首页「下载客户端」卡沿用其逻辑，入口改为弹窗按钮）。

**新建组件全集**（命名即实现文件名；类名列遵守 §8）：

| 组件 | 文件 | 屏 |
| --- | --- | --- |
| PayLayout | `layouts/PayLayout.vue` | 收银台外壳 |
| CheckoutPage | `views/pay/CheckoutPage.vue` | 收银台容器（态机调度） |
| OrderPayPage | `views/pay/OrderPayPage.vue` | 收银台订单态容器 |
| TierTabs | `components/pay/TierTabs.vue` | 档位 tab |
| SkuCards / SkuCard | `components/pay/SkuCards.vue`、`SkuCard.vue` | 时长卡组/单卡 |
| PurchaseBar | `components/pay/PurchaseBar.vue` | 购买条 |
| TermsConfirmModal | `components/pay/TermsConfirmModal.vue` | 协议确认弹窗（双视图） |
| QrStage | `components/pay/QrStage.vue` | 二维码+倒计时+取消+帮我查（含 waitFail 内嵌） |
| PayDonePanel / PayClosedPanel / PayFailCreatePanel / PayVerifyPanel | `components/pay/*Panel.vue`（四件） | 收银台四个终态/异常面板 |
| OrderTimeline | `components/pay/OrderTimeline.vue` | 订单流程时间线（详情页复用） |
| CopyableNo | `components/pay/CopyableNo.vue` | 微信单号脱敏+复制 |
| HomeBanner | `components/dashboard/HomeBanner.vue` | 首页进行中横幅 |
| MembershipHero | `components/dashboard/MembershipHero.vue` | 套餐总览头 |
| GrantTimeline | `components/dashboard/GrantTimeline.vue` | 时长构成时间线 |
| PendingGrantCard | `components/dashboard/PendingGrantCard.vue` | 待激活区块 |
| OrderRow | `components/dashboard/OrderRow.vue` | 订单列表行 |
| OrderKvPanel | `components/dashboard/OrderKvPanel.vue` | 订单信息 kv 面板 |
| RefundPage | `views/dashboard/RefundPage.vue` | 退款流容器（preview/processing/refunded/reject 四态） |
| RefundConfirmModal | `components/dashboard/RefundConfirmModal.vue` | 退款确认弹层 |
| DeviceRow + UnbindDeviceModal | `components/dashboard/DeviceRow.vue`、`UnbindDeviceModal.vue` | 设备行/解绑确认 |
| DashboardHome / MembershipPage / OrdersPage / OrderDetailPage / DevicesPage | `views/dashboard/*.vue` | 五个页面容器 |

新 composables / utils：`composables/useOrderPolling.ts`、`utils/format.ts`（fen→¥、北京时间、倒计时、微信单号脱敏）、`constants/pay-copy.ts`（§7 文案表落地为常量，实现单一来源）、`constants/agreement.ts`（协议全文示例稿 + 版本号，来自 cashier.html `<template id="doc-*">`）。

### 3.1 收银台（cashier.html，八态）

#### 3.1.0 态机总览

```
CheckoutPage（/pay）
  态〇 login     !session.isLoggedIn                       → 登录卡（选择保留）
  态一 pick      已登录默认态                               → 选套餐 + （可选）未支付单恢复横幅
    └─ TermsConfirmModal（去支付触发，双视图）
  └─ 创建订单成功 → router.replace /pay/order/:orderNo

OrderPayPage（/pay/order/:orderNo）——由订单状态驱动
  waiting    status=pending 且有 code_url → QrStage（轮询）
    └─ waitFail（内嵌子态）：「帮我查」返回 PAYERROR/USERPAY_ERROR
  paid       status=fulfilled → PayDonePanel（已到货·待激活）
  closed     status=closed   → PayClosedPanel（已过期）
  failVerify status=exception→ PayVerifyPanel（核对中，无重试）
  failCreate （前置态，见下）→ PayFailCreatePanel（下单失败）

failCreate 的归属：创建请求失败时（网关/微信连续失败，无 code_url），
CheckoutPage 本地态直接渲染 PayFailCreatePanel（不产生带单 URL 的跳转——
失败单可能未落库或无码，不写入 URL）。已落库但拿码失败的 pending 单（无
code_url）在 OrderPayPage 同样渲染 failCreate 面板，重试 = 重新调创建接口。
```

#### 3.1.1 态〇 · 未登录登录卡（CheckoutPage 内）

```
CheckoutPage
├── header：h1「登录后继续购买」 + sub「{已选 sku 摘要} —— 您的选择已保留」
└── .stage-narrow > .panel
    ├── AppInput(label=用户名, type=text, placeholder=请输入用户名, name=pay-login-username)
    ├── AppInput(label=密码, type=password, placeholder=请输入密码, name=pay-login-password)
    ├── AppButton(variant=primary, block, :loading=session.isLoading)「登录并继续购买」→ session.login()
    └── p.f-hint（居中）：还没有账号？lnk「注册即送 7 天全功能试用」· lnk「忘记密码」
    └── p：lnk「‹ 暂不购买，先逛逛」→ /
```

登录失败：卡内 `.f-err` 或 `useToast().error(msg)`（与 LoginPage 同口径：AppInput error 优先）。

#### 3.1.2 态一 · 选套餐

```
CheckoutPage（pick）
├── PayLayout 外壳：.back「‹ 返回控制台」+ .brand（logo-mark 爱 + 爱小说）
├── h1「升级套餐，解锁全部写作能力」
├── p.sub「一次性买断 · 到期不自动扣款 · 随时按剩余时长退款」
├── [可选] 未支付单恢复横幅（§5.4）
├── TierTabs          档位 tab（PRO｜MAX 即将推出）
├── #tierLive（tier.live 时）
│   ├── SkuCards      免费卡（当前方案）+ 时长卡 × N
│   ├── PurchaseBar   已选 + 应付 + 已省 + 去支付 CTA
│   └── .agree        「点击去支付后，将确认《购买协议》与《退款政策》要点（{version}）」
│   └── .foot         全部写作功能 · 时长可囤，激活才开始计时 · 原路退款
├── #maxPanel（tier=planned 时，.max-preview 虚线框）
└── TermsConfirmModal v-model:open（去支付触发）
```

**TierTabs**

| 项 | 内容 |
| --- | --- |
| Props | `tiers: PayTier[]`（`{key,label,live:boolean}`）、`modelValue: string` |
| Emits | `update:modelValue`（仅 live 档可 emit） |
| DOM | `.tabs > button[data-tier]`，选中 `.on`；MAX tab 文案「MAX 即将推出」 |
| 行为 | 点 planned 档：只切换 tab 并显示 `#maxPanel`（时长区整体隐藏，非禁用置灰——原型口径：切入即显预告面板）；点回 PRO 恢复 |
| a11y | `role=tablist/tab`，`aria-selected` |

**SkuCards / SkuCard**

| 项 | 内容 |
| --- | --- |
| Props（组） | `skus: PaySku[]`（当前 tier 的在售行）、`freeCard: FreeCardInfo`、`modelValue: string`（period）、`popular: string`、`buyers: number \| null`（<50 时后端返 null，不渲染徽标） |
| Emits（组） | `update:modelValue(period)` |
| Props（卡） | `sku`、`selected:boolean`、`isPopular:boolean`、`buyers:number\|null` |
| DOM（单卡） | `.card`（选中 `.on`；免费卡 `.card.free` + `.tag.cur` 当前方案）内：`.tag`（最受欢迎）/`.off`（9折/8折徽标）/`.p-name`/`.p-days`「{days} 天 · {devices} 台设备」/`.p-price`（整数价 `¥292` + `<small>元</small>`）/`.p-was`「原价 ¥365 元」（factor=1 不显示）/`.p-feat`（卖点 `<i>` 圆点列表）/`.p-note`「本月已有 {buyers} 人选择」 |
| 卖点文案 | 免费卡：`全部基础写作工具 / 不含 AI 能力 / 本地作品永久保留`（圆点 muted）；PRO 卡：`含免费全部功能 / AI 生成正文（流式） / 设定与章纲融入 AI`（圆点 accent）。事实源 C端 UpgradeModal.tsx（ADJUSTMENTS 2026-08-29 登记） |
| 行为 | 点付费卡 emit；免费卡 `cursor:default` 不可选（原型 `.card.free:hover` 不变色） |
| a11y | 组 `role=radiogroup aria-label=选择时长`，卡为 `<button role=radio :aria-checked>`；免费卡 `aria-disabled=true tabindex=-1` |

**PurchaseBar**

| 项 | 内容 |
| --- | --- |
| Props | `sku: PaySku`（选中行，价格展示**以服务端算价结果为准**——下单冻结口径） |
| Emits | `pay()`（CTA 点击 → 父组件打开 TermsConfirmModal） |
| DOM | `.purchase > .sel`（已选 `<b>` 「PRO · 包年（365 天）」）+ `.pay`（`.save`「已省 73 元」+ `.now` `.num`「¥292.00」）+ `.cta`「去支付」 |
| 说明 | CTA 不因协议禁用（弹窗式确认替代勾选框，决策 9）；金额展示 `¥xx.xx`（H4），卡片主价可按原型显示整数+「元」 |

**TermsConfirmModal（双视图，决策 9 留痕）**

| 项 | 内容 |
| --- | --- |
| Props | `open:boolean`、`orderSummary:string`（「PRO · 包年（365 天）· ¥292.00」）、`agreementVersion:string`（来自 skus 接口，当前 `v2026.08`） |
| Emits | `update:open`、`confirm()`（=「阅读并同意，去支付」点击） |
| Slots | 无（footer 用 AppModal footer slot 放两个按钮） |
| 内部状态 | `view: 'confirm' \| 'doc'`、`docKey: 'agreement' \| 'refund'`、`agreed: boolean` |
| 确认视图 | `.mcard-head`「确认购买协议」+ `.terms` 四要点（ol：一次性买断到期不自动扣款 / 到货后点激活才开始计时未激活可全额退 / 按剩余时长计算原路退回不影响其他套餐 / 本单摘要 `orderSummary`）+ 全文入口行「全文：《购买协议》（v2026.08）·《退款政策》（v2026.08）」+ `.terms-agree` label（checkbox + 「我已阅读并同意《购买协议》与《退款政策》：按剩余时长折算退款、原路退回」）+ footer「再想想」（secondary）/「阅读并同意，去支付」（primary，`agreed` 为 false 时 disabled） |
| 全文视图 | `.mcard-head`（标题「购买协议/退款政策」+ `.lnk`「‹ 返回确认」）+ `.doc-body`（`max-height:52vh; overflow-y:auto` 滚动区，内容来自 `constants/agreement.ts` 渲染 `<h4>+<ol>+版本行`） |
| 打钩重置 | **每次打开重置**：`view='confirm'`、`agreed=false`、主按钮禁用（原型 openTerms 行为照抄） |
| 留痕 | `confirm` emit 后由父组件调 `apiPayCreateOrder({sku_id, agreement_version})`；`agreed_at` 由服务端记（防客户端时钟），orders 落 `agreement_version+agreed_at`、trade_events 落 `terms_agreed`（PRD 决策 9） |
| 全文内容 | 示例要点稿：购买协议 6 条 / 退款政策 6 条，逐字来自 cashier.html `<template id="doc-agreement">` / `<template id="doc-refund">`（正式文本运营定稿后升版本号替换，ADJUSTMENTS 2026-08-29 登记） |

#### 3.1.3 态二 · 等待支付（QrStage）与 waitFail 内嵌

```
OrderPayPage（waiting）
├── h1「微信扫码支付」 sub「订单号 {orderNo} · {sku 摘要}」
└── .stage-narrow
    ├── .notice.info：「请使用微信扫描二维码完成支付。¥{amount} 支付成功后套餐立即到货，激活后开始计时。」
    ├── .panel > .qr-stage
    │   ├── .qr-box（canvas，188×188，code_url 渲染；aria-label=微信支付二维码）
    │   ├── .countdown「二维码有效期剩 mm:ss」（.num；由 expires_at 本地推算，§4.4）
    │   └── AppButton(variant=ghost)「取消支付」→ apiPayCancelOrder → 回 /pay（保留选区）
    ├── p：「已扫码付款但页面没变化？」+ button.lnk「我已支付，帮我查一下到账」（§4.5）
    └── [waitFail] .notice.warn（内嵌，不跳页不新屏）+ p「反复失败？」lnk「取消本单，重新下单」· lnk「联系客服」
```

| QrStage Props/Emits | 内容 |
| --- | --- |
| Props | `order: PayOrderView`（orderNo/amountFen/skuLabel/codeUrl/expiresAt）、`checkResult: 'idle'\|'fail'\|'notpay'\|'checking'` |
| Emits | `cancel()`、`resync()`（帮我查） |
| 轮询 | 组件内不持有轮询——由 `useOrderPolling`（OrderPayPage 持有）驱动 `order` 更新（§4.4），保证卸载清理单点 |
| 二维码渲染 | 引入 `qrcode`（npm，MIT，纯编码库非 UI 库，不违反 H1）把 `code_url` 画到 `<canvas width=176 height=176>`；原型 SVG 是占位（ADJUSTMENTS 偏差登记），实现用真码 |
| waitFail 呈现 | `checkResult='fail'`：warn notice「查过了：微信显示本次支付未成功（如余额不足、银行卡限额，或您取消了支付）。二维码仍然有效——请重新扫码，或在手机上更换支付方式后重试。」；`checkResult='notpay'`：info notice「未查到支付记录，稍候再查」（PRD §7 口径，原型未呈现此文案，见 OQ3） |

#### 3.1.4 态三~六 · 终态面板（四件套）

| 面板 | 触发 | 结构要点 | 主/次操作 |
| --- | --- | --- | --- |
| PayDonePanel（paid） | 轮询命中 fulfilled | `.done-mark`（ok 对勾）+ `.serif`「包年 · 已到货，待激活」+ 说明「点『立即激活』马上开始计时；先存着也随时可在『我的套餐』激活」+ `.kv` 五行（支付金额/获得时长/生效方式「激活后，接在试用结束后开始」/支付方式/协议确认「v2026.08 · 已同意（14:22）」） | 「立即激活」（primary，调 `apiPayActivateGrant`，成功后原地变为已生效态并 toast，OQ13）/「返回控制台」（secondary，/dashboard）/ lnk「先存着，之后在『我的套餐』激活」（/dashboard/membership） |
| PayClosedPanel（closed） | 轮询命中 closed | warn notice「本次订单未支付成功，没有产生扣款。重新下单将按当前价格生成新订单。」+ panel 行「PRO · 包年（365 天）· 下单时价格 ¥292.00」+ lnk「对价格有疑问？看看当前活动说明」 | 「重新下单」（primary → `/pay?sku={sku_id}`） |
| PayFailCreatePanel（failCreate） | 创建失败（无 code_url） | err notice「网络波动或支付服务暂时不可用，本次未能生成支付二维码。没有产生扣款，请重试。」+ panel 行（sku + 价格）+ lnk「反复失败？联系客服」 | 「重试」（primary，重新创建/重新拿码）/「返回重选」（ghost → /pay） |
| PayVerifyPanel（failVerify） | status=exception | err notice「已收到您的支付，系统正在核对金额，暂未到账。资金安全、不会丢失——请勿重复支付。」+ panel（「核对一般几分钟内完成…」「超过 30 分钟未到账，请携带订单号联系客服人工处理。」） | 「联系客服」（primary）/「查看我的订单」（secondary → /dashboard/orders）。**无重试按钮**（防重复支付，PRD §7） |

#### 3.1.5 MAX 预告（planned 档）

`#maxPanel`：`.max-preview`（虚线框）「MAX · 即将推出」+ meta「更高设备上限 · 更强 AI 能力。档位由后台配置上线——上线后此处自动变为可选时长与价格，无需改版。」数据驱动：tiers 配置行 `live=false` 即渲染，前端零改动上新（PRD 决策 7）。

### 3.2 控制台首页（console.html）

```
DashboardHome（/dashboard）
├── .page-head：h1「你好，{username}」+ .sub「{北京时间 yyyy 年 M 月 d 日 · 星期X}」
│                + AppButton(primary)「续费或购买时长」→ /pay
│                （试用临期态：「购买套餐，继续使用」）
├── HomeBanner（L1 被动提醒，最多一条，优先级：退款处理中 > 试用临期 > （无））
│   └── .notice.warn：「您有一笔退款正在处理中（预计退 ¥7.76，一般数分钟至 3 个工作日到账）。lnk 查看进度」
│       或 试用态：「试用还剩 2 天。到期后回到免费版：本地作品与数据不受任何影响，AI 与高级功能需购买套餐继续。lnk 看看套餐」
└── .cards（2×2 grid，均为 AppCard hoverable）
    ├── 我的套餐卡（试用态加 .hl）：panel-h「我的套餐」+ 状态 pill（生效中 pill-ok / 试用 · 剩 2 天 pill-warn）
    │   .row：.big「PRO」 + .pill-tag「包年 · 5 台设备」
    │   .row：.metric「455<small>天剩余</small>」+ .meta「最远到期 2027-11-26 · 正在消耗：包季（剩 66 天），包年已排队」
    │   .ops：AppButton(secondary,sm)「查看套餐明细」→ /dashboard/membership（试用态：primary,sm「购买套餐」）
    ├── 我的设备卡：panel-h「我的设备」+ .meta「额度按已购最高档计算」；.metric「2/5 台」+ 设备行摘要；.ops「管理设备」
    ├── 下载客户端卡：meta「在客户端里使用全部写作功能；套餐时长与设备额度与网页端同步。」+ Windows 版/macOS 版按钮 + 「v0.12 · 约 30 MB」（DownloadModal）
    └── 我的账户卡：meta「账号 {username} · 注册于 {date}」+「修改密码」（/dashboard/account）+ lnk「退出登录」（session.logout）
```

| HomeBanner | 内容 |
| --- | --- |
| Props | `notices: HomeNotice[]`（来自 membership summary，§4.2） |
| 渲染 | 只取第一条；类型 `refund_processing`（含 est_fen）/`trial_ending`（含 days_left） |
| a11y | `role=status` |

数据源：挂载 `Promise.all([session.fetchUserInfo(), membershipStore.fetchSummary(), deviceStore.fetchDevices()])`，usePageLoad 统一 loadError/retry。激活码 modal 与 LicenseCard 整体移除。

### 3.3 我的套餐（membership.html）

```
MembershipPage（/dashboard/membership）
├── .page-head：h1「我的套餐」+ sub（付费态「档位按已购最高档计算，时长按购买顺序先后消耗。」/免费态「购买后，套餐的使用情况与历史会展示在这里。」）
│                + AppButton(primary)「续费或购买时长」→ /pay（免费态：「去购买套餐」）
└── .stack
    ├── MembershipHero（.panel）
    │   ├── .panel-h：.tier-hero（.name「PRO」+ .pill-tag「包年」+ .pill-status pill-ok「生效中」+ .pill-tag「5 台设备」）
    │   │            右侧 .sum：剩余合计 <b>455 天</b>（已激活）· 最远到期 <b>2027-11-26</b> · 待激活 <b>1 个</b>（365 天）
    │   ├── .notice.info：「已激活的包年即刻把设备额度提升到 5 台；当前正在消耗包季时长，包季到期后包年自动接上。您还有 1 个套餐待激活——不计时、不占额度，想囤着随时激活。」（按数据拼装）
    │   └── GrantTimeline
    │       ├── .tl-bar（aria-hidden，.seg-past/.seg-now/.seg-future 宽度按 days 真实比例 flex）
    │       ├── .tl-rows（.tl-row×N：.tl-dot past/now/future/frozen + 名称 + `.pill-tag` 状态（消耗中/已激活 · 排队中/已耗完/**退款冻结**）+ .dates「起止 · 剩 N 天」）
    │       └── PendingGrantCard（每个待激活行一张，虚线框）
    │           「PRO 包年 · 365 天」+ .pill-accent「待激活」+ 「2026-10-05 支付 · 激活后才开始计时，未激活可全额退」+ AppButton(primary,sm)「立即激活」
    └── 设备摘要 panel（panel-h「我的设备」+「已绑定 2 / 5 台」+ .dev-row×N + 尾注「额度按已激活最高档计算（包年 = 5 台）；待激活套餐不占额度。lnk 管理全部设备 · lnk 换设备怎么办？」）
```

| 组件 | Props/Emits |
| --- | --- |
| MembershipHero | Props：`summary: MembershipSummary`；无 emits（动作下放） |
| GrantTimeline | Props：`grants: GrantRow[]`（`{id,order_no,name,tier,days,state:'past'\|'now'\|'future'\|'pending'\|'frozen',grant_start,grant_end,remaining_text}`）；时间线行点击 → `/dashboard/orders/:orderNo`（可选，OQ12） |
| PendingGrantCard | Props：`grant: GrantRow`；Emits：`activate()` → `apiPayActivateGrant({order_no})` → 成功 toast「已激活，接在 {最远到期日} 后开始」+ 刷新 summary |
| 免费态 | tier-hero 显示「试用」+ pill-warn「剩 2 天」+ pill-tag「1 台设备」；时间线仅试用一行；设备尾注「试用与免费版限 1 台设备；购买后：包月/包季 3 台、包年 5 台。lnk 对比各档位」 |

权益语义锚点（PRD 子决策）：待激活不计时/不占额度/退款全额/永不过期；剩余时长=Σ已激活行(终点−max(今天,起点))，待激活另计「N 个」；档位=已激活行按等级序取最高（C2）；展示口径=概览给剩余天数+最远到期日，明细给每行起止（订单行不带起止，ADJUSTMENTS 本体论修正）。

### 3.4 我的订单（orders.html）

```
OrdersPage（/dashboard/orders）
├── .page-head：h1「我的订单」
│   + sub「全部订单（含等待支付、退款中、已过期等各类状态）都在这里，可对任一订单单独申请退款；点订单查看详情与全部操作。」
│   + AppButton(primary)「购买或续费」→ /pay
├── .panel（padding:6px 0）
│   └── OrderRow × N（.order-row，grid：信息列 / 状态金额列 148px / 详情 64px）
│       ├── .order-main：.order-title「<b>PRO · 包季</b> + .pill-tag『90 天』」
│       │               .order-sub：「订单号 S…（.num）」+「2026-08-28 14:22 支付」/「今天 15:40 创建 · 二维码有效期剩 06:12」（pending）/「… · 2026-07-12 退款 ¥19.20」/「… · 支付金额核对中，暂未到账」（exception）
│       ├── .order-amt：`.v`（.num 金额；已退款加 line-through+muted）+ 状态 pill + `.r`「预计退 ¥7.76」（退款中）
│       └── lnk「详情 ›」→ /dashboard/orders/:orderNo
├── .notice.info（列表尾）：「退款按剩余时长折算、原路退回；退某一单不影响其他套餐的起止时间。见退款政策。」
└── 空态（EmptyState）：icon + serif「还没有订单」+「购买套餐后，订单与时长明细会展示在这里。」+ AppButton(primary)「去购买套餐」→ /pay
```

| OrderRow | 内容 |
| --- | --- |
| Props | `order: OrderListItem` |
| Emits | 无（整行「详情 ›」链接跳转；**行内无任何动作**——ADJUSTMENTS 2026-08-29：行内七种动作是本体论残留，行=信息+唯一动作详情） |
| 状态 pill 映射 | 见 §4.3 表（六状态全集：等待支付 warn / 已支付 ok / 退款中 warn / 已退款 tag / 已过期 tag / 核对中 warn） |
| 排序/分页 | 默认创建时间倒序；分页策略 OQ4（暂设计：一次拉全量 + 前端无分页，接口预留 `page/page_size`） |

### 3.5 订单详情（order-detail.html，六态）

```
OrderDetailPage（/dashboard/orders/:orderNo）
├── .page-head：h1「订单详情」+ 状态 pill（#statePill）
├── 状态说明条（#stateNotice）：.notice info/warn/err（文案见 §7 表 T5-2）
├── OrderKvPanel（.panel，订单信息全量）
│   ├── panel-h：「订单信息」+ 右侧「订单号 S…（.num）」
│   └── .kv（grid 110px/1fr）逐行：
│        套餐「PRO · 包季（90 天）」/ 支付金额 ¥72.00（.num）/ 下单时间（.num 北京时间）
│        支付时间（waiting 态显示「—」）/ 微信支付单号（CopyableNo：4200****7721 + 复制）
│        + 小字「对账/投诉时提供给客服」/ 协议确认「v2026.08 · 14:21 已同意」/ 套餐起止「2026-08-30 ～ 2026-11-27」
│        （各状态隐藏字段见 §7 T5-3）
├── OrderTimeline（.tl）
│   ├── .tl-h「订单流程 —— 每个环节均记录状态变化时间（进行中环节为预计时间）；单号可在对账或投诉时提供给客服」
│   └── .tl-row × N（.tl-mark done/now/todo + 文案 + .when 时间）
├── 【发票区暂缓】.inv-panel 占位说明（§3.8，实现不渲染）
├── .ops（状态操作聚合，justify-end）+ 尾注「有疑问？lnk 联系客服（请提供上方订单号）」
└── [RefundConfirmModal 等，按操作挂载]
```

| OrderDetailPage 状态机（六态配置，照抄原型 STATES） | 状态 pill | notice | kv 隐藏字段 | ops |
| --- | --- | --- | --- | --- |
| paid（fulfilled） | pill-ok 已支付 | info「套餐已到货。计时从 {grant_start} 开始；未激活前可全额退。」 | 无 | 申请退款(secondary) · 去我的套餐(primary) · ~~获取发票~~（暂缓） |
| waiting（pending） | pill-warn 等待支付 | warn「订单 15 分钟内有效，超时自动过期。二维码请在等待支付页查看。」 | 套餐起止、微信支付单号 | 继续支付(primary → /pay/order/:no) · 取消订单(ghost) |
| refund_pending（冷静期） | pill-warn 退款中·冷静期 | warn「退款将在 N 分 N 秒后提交（套餐已停止使用）。冷静期内可取消恢复使用。」+倒计时 | 倒计时归零自动转 processing | **取消退款**(primary)（拍板：5 分钟冷静期） |
| refund_processing（已提交微信） | pill-warn 退款中 | warn「退款已受理，原路退回中；套餐已冻结停止使用。到账后本单转为已退款。」 | 无 | 无（不可自助撤） |
| refunded | pill-tag 已退款 | info「退款已完成，原路退回您的微信；对应套餐已收回，其他套餐不受影响。」 | 无 | 再来一单(secondary → /pay?sku=) |
| expired（closed） | pill-tag 已过期 | info「超时未支付自动过期，未产生扣款。重新下单按当前价格生成新订单。」 | 支付时间、协议确认、套餐起止、微信支付单号 | 重新下单(primary) |
| verify（exception） | pill-err 核对中 | err「已收到您的支付，系统正在核对金额，暂未到账。资金安全、不会丢失——请勿重复支付。核对完成将自动到账。」 | 套餐起止 | 联系客服(primary) |

时间线 steps 由后端返回（推荐：`timeline: [{key,title,when,state}]`），前端只渲染；无退款环节的单不含退款节点（PRD 单据链）。waiting 态时间线含倒计时文案「等待支付（二维码有效期剩 06:12）」——该行 `when` 为空、由前端实时拼接（OQ12 附带）。

**CopyableNo**

| 项 | 内容 |
| --- | --- |
| Props | `value: string`（完整单号）、`masked: string`（如 `4200****7721`，由 utils.maskWxNo 生成也可后端给）、`note?: string` |
| DOM | `.wx-no > .num{masked} + .copy`（「复制」→ `navigator.clipboard.writeText(value)`，成功后 1.2s 内显示「已复制」，原型行为照抄） |
| 降级 | 剪贴板 API 不可用（非安全上下文）→ `document.execCommand('copy')` 兜底；仍失败 toast「复制失败，请手动记录」 |
| a11y | button `aria-label=复制完整单号` |

### 3.6 退款流（refund.html，四态 + 两拒绝态）

```
RefundPage（/dashboard/orders/:orderNo/refund）
├── 态一 preview（默认，进入即见金额——U2 预览折算额）
│   ├── .page-head：h1「申请退款」+ sub「退款按剩余时长折算，原路退回您的微信。本操作只影响这一笔订单。」
│   └── .stage-narrow > .panel
│       ├── panel-h：「包月 · 30 天」+ pill-ok「已到账」
│       ├── .kv：订单号 / 支付时间 / 实付金额 ¥24.00 / 套餐时长「2026-08-22 ～ 2026-09-20」/ 剩余时长「9 天 16 小时 48 分」
│       ├── hr + .refund-hero：.v「¥7.76」（.num 34px accent-strong）+ .u「预计退款（原路退回）」
│       ├── .rule-note：「按剩余时长计算退款，精确到秒，金额四舍五入到分；未激活或排队中（未消耗）的套餐退款为全额。以您点确认的这一刻为准计算剩余；确认后套餐立即停止使用。」
│       ├── AppButton(primary,lg)「确认退款金额，继续」→ 打开 RefundConfirmModal；lnk「先不退了」
│       └── 页尾 lnk「看看退款政策全文」（constants/agreement.ts 退款政策视图复用 TermsConfirmModal 的 doc 渲染或独立只读弹窗）
├── 态二 confirm：RefundConfirmModal（.scrim+.modal show）
│   ├── .kv：订单号 / 实付金额 / 剩余时长 / 退款金额（¥7.76 高亮）
│   ├── .rule-note：「提交后：对应套餐立即停止使用；退款原路退回您的微信，一般数分钟至 3 个工作日到账。已开票订单将同步处理发票冲红。」（注：发票暂缓期文案删去发票句，OQ11）
│   └── footer：「再想想」(secondary) /「确认退款」(primary → apiPayRequestRefund)
├── 态三 processing：page-head「退款处理中」+ pill-warn 退款中
│   └── .panel 居中：.done-mark.warn（时钟图标）+ serif「已受理，正在退回 ¥7.76」
│       +「原路退回您的微信，一般数分钟至 3 个工作日到账；当天支付当天退，可能稍晚，款项不会丢失。」
│       + .kv：折算基准「2026-08-22 18:30（您确认退款时）」/ 套餐使用「已停止」
│       + AppButton(secondary)「返回我的订单」
├── 态四 refunded：page-head「退款完成」+ pill-tag 已退款
│   └── .panel 居中：.done-mark.ok + serif「¥7.76 已原路退回」
│       +「2026-08-22 19:02 退回微信 · 对应套餐时长已收回」
│       + .kv：其他套餐「不受影响，按原起止继续」/ 套餐功能「如无其他套餐，已回到免费版」
│       + AppButton(primary)「返回我的订单」
│       + .notice.info：「需要继续使用套餐功能？lnk 随时可以重新购买套餐，时长从头计算。」
└── 拒绝态（preview 请求返回 refundable=false + reason）
    ├── reject-fen（剩余不足 1 分）：err notice「这笔订单剩余约 10 分钟，折算金额不足 1 分钱，无法发起退款。」
    │   + panel「订单即将到期，剩余时长可直接用完」+「返回我的订单」
    └── reject-window（超 1 年窗）：err notice「这笔订单支付已超过 1 年，超出微信退款通道的受理窗口，无法在线退款。」
        + panel「如确有特殊情况，客服会帮您看还能怎么处理」+「联系客服」
```

冻结式退款口径（PRD 子决策，2026-08-29 修订）：确认即冻结停止使用，折算以确认时刻为准；失败不解冻、无「失败恢复」态、冻结期间不补偿——**界面没有也不允许出现**「处理期间继续使用」「失败已恢复」类文案。processing 态可由订单详情/控制台横幅再次进入（数据同源），不自动轮询退款状态（到账由微信通知用户，PRD storymap G）。

### 3.7 我的设备（devices.html）

```
DevicesPage（/dashboard/devices）
├── .page-head：h1「我的设备」+ sub「套餐在设备上登录后自动绑定；解绑后原设备立即失去同步能力。」
│                + .quota-head：.big「2<span> / 5</span>」+ .small「台已绑定 · 额度按已激活最高档（PRO 包年）」
├── .notice.info：「换新电脑？直接在新设备登录会提示额度；解绑任意旧设备即可腾出名额，解绑即时生效。」
├── .panel（padding:8px 22px）
│   └── DeviceRow × N（.dev-row：host + dev-meta「macOS · 爱小说客户端 v0.12 · 最近活跃：今天 14:22」
│        + 当前设备 pill-ok「当前设备」/ AppButton(secondary,sm)「解绑」）
└── 尾注：「免费版与试用限 1 台；PRO 包月/包季 3 台、包年 5 台。lnk 查看我的套餐」
```

| UnbindDeviceModal | 内容 |
| --- | --- |
| Props | `open:boolean`、`device: DeviceItem` |
| Emits | `update:open`、`confirmed()` → `deviceStore.removeDevice(id)`（复用） |
| 文案 | 标题「解绑设备」；正文「解绑后『Mac mini』立即失去同步能力；额度即时释放。确定解绑？」；footer「再想想」/「确认解绑」（primary；破坏性确认用 in-app 弹窗，禁原生 confirm——ADJUSTMENTS 实现注记） |

数据：复用 `deviceStore`；`active_limit` 后端已随套餐档返回（额度=已激活最高档，待激活不占额度）。

### 3.8 发票暂缓占位说明（唯一保留的设计记忆）

- **暂缓范围**（PRD 决策 8）：订单详情「获取发票」按钮与 ops 项、开票申请弹层（抬头 seg 个人/企业单位 + 动态字段 + 邮箱 + 提交回执）、订单详情「发票」区块（`.inv-panel` 蓝票/红字行）、发票详情页 `/dashboard/orders/:orderNo/invoice/*`（invoice.html 可打印版式）。
- **将来恢复点**：order-detail.html 尾部注释区保留了完整弹层 HTML 与 JS（`invModal`/抬头切换/校验/成功回执）+ `if (false)` 暂缓守卫——实现 change 以该注释为蓝本恢复；恢复时 ops 加回 `["获取发票","btn-secondary"]`。路由表预留 `orders/:orderNo/invoice` 段位（本期不注册）。
- **本期联动**：退款确认弹层文案中「已开票订单将同步处理发票冲红」一句在暂缓期删除（无开票可能），恢复发票时加回（OQ11）。

---

## 4. API 层

> **⚠️ 契约以 `backend-detail-design.md` 附录 Z（联合契约唯一版本）为准**——已对齐：错误码=数字码+前端映射、refund-preview=GET kebab、激活=grants/activate{order_no}、微信单号=完整值+前端脱敏渲染、membership 路径、pending 恢复端点、refund/cancel 新增。本节字段名不一致处以附录 Z 为准。

### 4.1 模块清单：`src/api/pay.ts`（函数签名）

沿用 `api/web.ts` 模式（`request` 实例 + `ApiResponse<T>` 信封 + `code!==0` 拦截器 reject）。所有金额字段 `amount_fen: number`（int 分），时间 ISO UTC 字符串（展示层转北京时间）。

```ts
// ── 商品与配置 ──
export function apiPaySkus(): Promise<ApiResponse<PaySkusView>>
// GET /pay/skus： tiers + skus + free_card + popular + buyers + agreement_version

// ── 下单/支付 ──
export function apiPayCreateOrder(payload: { sku_id: string; agreement_version: string }): Promise<ApiResponse<PayOrderCreate>>
// POST /pay/orders：失败（err_code='WXPAY_CREATE_FAILED' 等）→ failCreate 态
export function apiPayPendingOrder(): Promise<ApiResponse<PayOrderView | null>>
// GET /pay/orders/pending：pick 态恢复横幅 + 下单复用（同 sku 未过期 pending 单后端复用，PRD §7）
export function apiPayGetOrder(orderNo: string): Promise<ApiResponse<PayOrderDetail>>
// GET /pay/orders/{no}：轮询与详情共用（详情多 timeline/wx 单号字段）
export function apiPayQueryOrder(orderNo: string): Promise<ApiResponse<{ query_state: PayQueryState }>>
// POST /pay/orders/{no}/query：「我已支付帮我查」——服务端主动查微信后返回
export function apiPayCancelOrder(orderNo: string): Promise<ApiResponse<void>>
// POST /pay/orders/{no}/cancel：取消支付（服务端走关单铁律）

// ── 订单列表 ──
export function apiPayOrders(params?: { page?: number; page_size?: number }): Promise<ApiResponse<OrderListItem[]>>

// ── 退款 ──
export function apiPayRefundPreview(orderNo: string): Promise<ApiResponse<RefundPreview>>
// GET /pay/orders/{no}/refund-preview
export function apiPayRequestRefund(orderNo: string, reason: string): Promise<ApiResponse<{ refund_fen: number }>>
// POST /pay/orders/{no}/refund：客户端只传 order_no（金额服务端折算，PRD §八）
export function apiPayCancelRefund(orderNo: string): Promise<ApiResponse<void>>
// POST /pay/orders/{no}/refund/cancel：取消退款申请（OQ1——是否保留由答案定）

// ── 套餐（我的套餐/首页） ──
export function apiPayMembership(): Promise<ApiResponse<MembershipSummary>>
// GET /pay/membership：summary + grants + notices
export function apiPayActivateGrant(payload: { order_no: string }): Promise<ApiResponse<{ grant_start: string; grant_end: string }>>
// POST /pay/grants/activate：立即激活（到货页/待激活区块共用）
```

### 4.2 DTO（前端视角的最小集）

```ts
interface PaySkusView {
  agreement_version: string            // 'v2026.08'（协议版本单一来源）
  tiers: { key: string; label: string; live: boolean }[]          // [{pro,PRO,true},{max,MAX,false}]
  skus: { sku_id: string; tier: string; period: 'monthly'|'quarterly'|'yearly';
          name: string; days: number; base_fen: number; price_fen: number; // 服务端已算（base×factor）
          factor: number; devices: number }[]
  free_card: { name: string; devices: number; remaining_days: number | null;  // 试用剩 N 天；免费版为 null
               features: string[] }
  popular: string | null               // 'yearly'；人数<50 时 null（冷启动诚实）
  buyers: number | null                // 近 30 天购买数；<50 为 null
}

type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'refund_pending' | 'refund_processing'
                 | 'refunded' | 'exception' | 'closed'

interface PayOrderView {                 // 轮询/收银台用
  order_no: string; sku_id: string; sku_label: string; days: number
  amount_fen: number; status: OrderStatus
  code_url: string | null; expires_at: string | null   // pending 必有；failCreate 单 code_url=null
  paid_at: string | null
}

interface PayOrderDetail extends PayOrderView {         // 详情页用
  created_at: string; agreement_version: string | null; agreed_at: string | null
  grant_range: [string, string] | null                  // 套餐起止（有台账行才有）
  wx_transaction_id: string | null                      // 完整值，前端脱敏展示+复制（属主可见）
  refund?: { refund_fen: number; requested_at: string; wx_refund_id: string | null }
  timeline: { key: 'created'|'paid'|'fulfilled'|'refund_requested'|'refund_returning'|'refund_done'|'closed'|'verify'
            ; title: string; when: string | null; state: 'done'|'now'|'todo' }[]
}

interface OrderListItem {
  order_no: string; sku_label: string; days: number; amount_fen: number; status: OrderStatus
  created_at: string; paid_at: string | null; refunded_at: string | null
  refund_estimate_fen: number | null      // 退款中行「预计退 ¥7.76」
  expire_at: string | null                // pending 行倒计时
}

interface RefundPreview {
  refundable: boolean
  reason: 'below_one_fen' | 'over_one_year' | 'not_paid' | 'in_progress' | null
  paid_fen: number; total_sec: number; remain_sec: number
  refund_fen: number                      // round_half_up(paid×remain/total)，封顶 paid
  grant_range: [string, string] | null; remain_text: string   // 「9 天 16 小时 48 分」
}

interface MembershipSummary {
  tier_label: string; period_label: string | null       // 免费态 '试用'/'免费'
  status: 'active' | 'trial' | 'free'
  remaining_days: number | null; max_expires_at: string | null
  pending_count: number; pending_days_total: number
  device_quota: { used: number; limit: number; basis: string }   // 「PRO 包年」
  grants: GrantRow[]
  notices: ({ type: 'refund_processing'; est_fen: number; order_no: string }
           | { type: 'trial_ending'; days_left: number })[]
}

interface GrantRow {
  id: string; order_no: string; name: string            // 「注册试用」/「包季」/「PRO 包年」
  days: number; state: 'past' | 'now' | 'future' | 'pending' | 'frozen'
  grant_start: string; grant_end: string; paid_at: string | null
  remaining_text: string | null                         // 消耗中行「剩 66 天」
}
```

### 4.3 状态/错误码 → UI 态映射

**订单状态 → UI（单一映射表，列表行/详情 pill/收银台共用）**

| OrderStatus | UI 态名 | pill 类 | 收银台面板 | 详情 ops |
| --- | --- | --- | --- | --- |
| pending（有 code_url） | 等待支付 | `pill-status pill-warn` | QrStage 轮询 | 继续支付/取消订单 |
| pending（code_url=null） | 下单失败 | — | PayFailCreatePanel | （详情一般不达，failCreate 停收银台） |
| paid / fulfilled | 已支付（已到货） | `pill-status pill-ok` | PayDonePanel（fulfilled） | 申请退款/去我的套餐 |
| refund_pending（冷静期） | 退款中·冷静期 | `pill-status pill-warn` | 倒计时归零→processing | **取消退款**(primary)→cancel 端点→fulfilled / 4007 不可撤 |
| refund_processing | 退款中 | `pill-status pill-warn` | 微信回调→refunded | 无操作 |
| refunded | 已退款 | `pill-tag`（无色） | — | 再来一单 |
| closed | 已过期 | `pill-tag` | PayClosedPanel | 重新下单 |
| exception | 核对中 | 列表行 `pill-warn`；详情/收银台 `pill-err`（原型两处如此，照抄） | PayVerifyPanel | 联系客服 |

**业务错误**：沿用信封 `code:1 + msg`，pay 域错误原因放 `data.err_code`（拦截器把 code!=0 reject 成 Error 后，`e.response` 不可得——设计：pay 接口在自身封装内 catch 并把 `err_code` 附加到 Error，或后端将 err_code 放 msg 前缀。**取前者**：`api/pay.ts` 统一 `wrapPayError(e)` 给 `Error.errCode`）。

| err_code | UI 态 |
| --- | --- |
| `WXPAY_CREATE_FAILED` / 网络错误（无 code） | failCreate 面板（未扣款可重试） |
| `ORDER_NOT_FOUND` / `NOT_OWNER` | toast error「订单不存在」+ 返回 /dashboard/orders（404 而非 403，PRD B4） |
| `ORDER_STATE_CONFLICT`（如非 pending 取消） | toast warn + 刷新订单态 |
| `REFUND_BELOW_ONE_FEN` | reject-fen 拒绝态 |
| `REFUND_OVER_ONE_YEAR` / `REFUND_REMAIN_ZERO` | reject-window 拒绝态（已到期同形，后端判因——ADJUSTMENTS 口径） |
| `REFUND_IN_PROGRESS` | toast warn「该订单已有进行中的退款」 |
| `AGREEMENT_REQUIRED` | 重新弹协议弹窗 |
| `code===2` / HTTP 401 | 现有拦截器硬跳 `/login?redirect=…`（§2.3-6） |

**查单结果 `PayQueryState`**（「帮我查」）：`SUCCESS`（轮询自然承接，无需特殊 UI）/ `NOTPAY`（info 内嵌「未查到支付记录，稍候再查」）/ `PAYERROR | USERPAY_ERROR`（warn 内嵌 waitFail 文案）/ `CLOSED`（转 closed 面板）。

### 4.4 轮询实现规格（`composables/useOrderPolling.ts`）

```ts
useOrderPolling(orderNo: Ref<string>) → {
  order: Ref<PayOrderView | null>,
  paused: Ref<boolean>,          // document.hidden
  start(): void, stop(): void,
  refreshNow(): Promise<void>,   // 立即单查（visibility 恢复/手动触发复用）
}
```

| 项 | 规格 |
| --- | --- |
| 节拍 | 首查立即；随后 **3s × 20 次（前 1 分钟）→ 5s × 48 次（至 8 分钟）→ 10s 直至过期**（15 分钟窗口内总请求 ≈ 130 次，量级无害且命中绝大多数在首 20 秒） |
| 退避 | 连续网络错误（无业务 code）×2 递增至 30s 封顶；成功即复位（沿用全站冷启动自愈口径，不另走 warmUpBackend——轮询本身就在打热实例） |
| 停止条件 | ① `status !== 'pending'`（终态跃迁，含 exception/closed）② 本地 `expires_at` 已过（最后补一次 refreshNow 让服务端官宣 closed，防本地时钟偏差直接渲染）③ `stop()` ④ 组件卸载 |
| 页面隐藏 | `visibilitychange`：`hidden` → 停表（不发请求）；`visible` → `refreshNow()` 后恢复节拍。理由：切屏扫码是高频动作，回来必须立刻见到结果 |
| 清理 | `onUnmounted(stop)` + `removeEventListener`；路由离开（onBeforeRouteLeave）stop——单点在 composable，组件不自行 setInterval |
| 状态跃迁反馈 | pending→fulfilled：面板切换（QrStage → PayDonePanel），焦点移到「立即激活」主按钮（§10.4），不弹 toast（页面本身就是反馈） |
| 倒计时 | QrStage 内独立 `setInterval 1s`，由 `expires_at − now` 推算 `mm:ss`；到 0 显示「已过期」并触发最后一次 refreshNow（OQ14） |
| 多标签页 | 不做 BroadcastChannel——每标签页独立轮询无害（幂等 GET），订单号同 URL |

### 4.5 「我已支付，帮我查一下到账」交互

1. 点击 → 按钮 loading（文案不变，`pointer-events-none`）→ `apiPayQueryOrder(orderNo)`。
2. `SUCCESS` → 随后一次轮询（或直接 refreshNow）命终态，面板自然切换。
3. `PAYERROR/USERPAY_ERROR` → `checkResult='fail'`：waiting 屏**内嵌** warn notice（不跳页不新屏——原型 waitFail 态），文案见 §7 T2-4；二维码保持显示（关单前持续有效，PRD §7）。
4. `NOTPAY` → `checkResult='notpay'`：内嵌 info「未查到支付记录，稍候再查」，8s 后自动消失回到无反馈态。
5. **节流**：5s 冷却（期间点击忽略），防连点打爆查单接口。
6. 反复失败出口：notice 下「反复失败？取消本单，重新下单 · 联系客服」常驻。

---

## 5. 状态管理（Pinia）

### 5.1 划分原则与清单

**进 store 的判据**：① 跨路由/跨页共享 ② 刷新后需恢复 ③ 多组件响应同一份数据。纯页面内展示态（弹窗开合、表单、局部 tab）一律组件局部 `ref`。

| 数据 | 归属 | 理由 |
| --- | --- | --- |
| 商品配置（skus/tiers/agreement_version） | `stores/pay.ts` | pick/协议弹窗/失败重试共用；缓存 5 分钟内不重拉（stale-while-revalidate） |
| 选中档位/时长（tier/period） | `pay store` + URL query（`/pay?sku=pro-yearly`） | 「您的选择已保留」「重新下单带 sku」都靠它；query 优先于 store（外链直达） |
| 当前支付单（orderNo/status/code_url/expires_at） | `pay store` | `/pay → /pay/order/:no → 返回重选` 全程不断链；**真正的事实源是 URL + 服务端**，store 只是工作副本 |
| 轮询控制器 | `useOrderPolling`（composable，不进 store） | 生命周期跟组件走，卸载即清；store 只存结果 |
| 「帮我查」反馈态（checkResult） | QrStage 局部 | 纯展示 |
| 协议弹窗开合/视图/agreed | TermsConfirmModal 局部 | 每次打开重置（决策 9） |
| 订单列表/订单详情 | 页面局部 + usePageLoad | 无跨页共享需求 |
| 退款流四态 | RefundPage 局部（态由 preview 结果 + 提交结果驱动） | 同上 |
| 套餐总览（summary/grants/notices） | `stores/membership.ts`（新） | DashboardHome 卡 + MembershipPage + 激活后多处刷新共用 |
| 设备 | `stores/devices.ts`（现有，复用） | 已有；quota 头直接用 `activeLimit` |
| 会话/tier/到期 | `stores/session.ts`（现有，扩展） | tier 语义随后端重构调整（OQ5） |
| toast | `stores/toast`（现有） | 全局提示唯一通道 |

### 5.2 `stores/pay.ts` 设计

```ts
export const usePayStore = defineStore('pay', () => {
  // state
  skusView: Ref<PaySkusView | null>
  skusFetchedAt: Ref<number>                    // 5min 缓存
  selectedTier: Ref<string>                     // 'pro'（默认取 popular 所在档）
  selectedPeriod: Ref<string>                   // 默认 = popular ?? 第一个在售 period
  activeOrder: Ref<PayOrderView | null>         // 当前支付单工作副本
  creating: Ref<boolean>                        // 创建中（防重复点击）

  // getters
  selectedSku: ComputedRef<PaySku | null>       // 由 tier+period 派生
  priceFen: ComputedRef<number | null>          // 展示用服务端价

  // actions
  async fetchSkus(force = false): Promise<void> // 缓存判断 + loadError 由页面 usePageLoad 管
  async resumePending(): Promise<PayOrderView | null>   // 挂载时查未支付单（§5.4）
  async createOrder(): Promise<{ ok: boolean; orderNo?: string; errCode?: string }>
  //   → 成功写 activeOrder 并 router.replace(`/pay/order/${orderNo}`)
  async cancelOrder(orderNo: string): Promise<{ ok: boolean }>
  //   → 成功清 activeOrder，回 /pay（选区保留）
})
```

### 5.3 membership / devices / session 扩展

- `stores/membership.ts`（新）：`summary: Ref<MembershipSummary|null>`、`fetchSummary()`、`activateGrant(orderNo)`（成功后重拉 summary）；沿用 devices store 的冷启动重试口径（`[20s,20s]` 仅无业务 code 网络错误重试）。
- `stores/devices.ts`：不改逻辑；设备页/首页卡读 `devices/totalCount/activatedCount/activeLimit`。
- `stores/session.ts`：`tierDisplay` 映射表随 tier 重构（monthly/quarterly/yearly → PRO/MAX × period）重写（OQ5）；`expires_at` 已有，首页试用临期横幅优先用 membership notices（口径统一）。

### 5.4 未支付订单恢复（刷新/换设备回到 waiting）

| 场景 | 行为 |
| --- | --- |
| 在 `/pay/order/:orderNo` 刷新 | 路由参数即订单号 → OrderPayPage 挂载 `refreshNow` → pending 则进 QrStage 恢复轮询（换设备同理，PRD §7） |
| 在 `/pay` 刷新/重进 | `payStore.resumePending()`（GET /pay/orders/pending）：存在未过期 pending 单 → pick 态顶部渲染恢复横幅（`.notice.info`）：「您有一笔未完成订单：{sku 摘要} · ¥{amount}，二维码有效期剩 mm:ss」+ AppButton(sm,primary)「继续支付」→ `/pay/order/:no` |
| 点「去支付」而已有同 sku pending 单 | 后端复用该单（PRD §7「重复点击/多标签页」），返回同一 orderNo，前端无感知 |
| 复用遇改价 | 后端比对冻结价与现价不一致关旧开新（PRD C6），前端只认返回的新单 |
| 未登录访问 `/pay/order/:no` | OrderPayPage 挂载先查登录：未登录渲染与态〇同款登录卡（副题「登录后查看订单 {orderNo}」），登录后原地恢复（redirect 兜底：`/login?redirect=/pay/order/:no`） |

---

## 6. C端 到期提示条（唯一 C端 改动）

### 6.1 check-auth 响应扩展（建议字段）

现状（`server/app/interfaces/client_api/authorize.py:140-149`）：

```json
{ "code": 0, "data": { "token", "username", "tier", "expires_at" } }
```

建议扩展（向后兼容，全部可选）：

```json
{ "code": 0, "data": {
    "token": "...", "username": "...", "tier": "pro", "expires_at": "2026-09-05T16:00:00Z",
    "days_remaining": 5,              // int，北京自然日口径；免费/无套餐 null（OQ9）
    "attention": {
      "refund_processing": false,     // 存在 refund_pending/refund_processing 订单
      "verify_pending": false         // 存在 exception（核对中）订单——「冻结待处理」
    }
} }
```

计算在后端（orders 与 codes 台账已有全部信息）；C端 不做任何日期推算。

### 6.2 挂载点与展示规则

| 项 | 规格 |
| --- | --- |
| 组件 | `client/frontend/src/components/LicenseNoticeBar.tsx`（新） |
| 挂载 | `App.tsx` 的 `<Navbar />` 之后、`<Routes>` 之外全局一行（所有页面顶部；`ClientShell` 内） |
| 数据源 | `useAuthHeal` 的 check-auth 结果——现状只 setToken，需小扩展：把 `res.data` 存入 auth store/context（新增 `useLicenseStatus` 或并入现有 auth 状态）；仍为**启动时一次拉取**，不加轮询（PRD §二：C端 是启动自愈，付款后重启客户端即生效） |
| 展示规则（优先级自上而下，同时只显示一条） | ① `verify_pending` → warn：「支付核对中：您近期一笔支付正在核对金额，请勿重复支付。查看订单」（→ S端 `/dashboard/orders`）② `refund_processing` → warn：「退款处理中：退款将原路退回您的微信，一般数分钟至 3 个工作日到账。查看进度」（→ 同上）③ `days_remaining <= 7 && > 0` → warn：「套餐还剩 {N} 天，到期后本地作品不受影响、AI 功能需续费继续。去续费」（→ S端 `/pay`） |
| 样式 | C端 base.css 同源词汇：`.notice.warn`（提示条四语气体系，H7；不引入新组件类）；链接用 `.lnk` |
| 交互 | 链接 = 系统浏览器打开 S端（沿用 UpgradeModal 跳转机制）；右侧「×」可关闭，`sessionStorage['license-notice-dismissed']=签名`（本次会话不再弹；签名=类型+关键数字，状态变化重新出现） |
| 不显示 | `days_remaining=null`、`tier=none/free`、三条均不满足；`data-theme` 主题下随 `--warn` 令牌自动适配 |

---

## 7. 文案表（实现单一来源）

> 实现时落地为 `src/constants/pay-copy.ts`；本表从原型逐字抄录（`{}` 为动态插值）。评审对原型，实现对本表。词汇自检：无 success/danger、无「激活码」、PRO 仅档名。

### T1 收银台 · 选套餐（pick）

| # | 位置 | 文案 |
| --- | --- | --- |
| T1-1 | h1 | 升级套餐，解锁全部写作能力 |
| T1-2 | sub | 一次性买断 · 到期不自动扣款 · 随时按剩余时长退款 |
| T1-3 | 档位 tab | PRO ／ MAX 即将推出 |
| T1-4 | 免费卡 | tag：当前方案；名称：免费；副行：1 台设备；价：¥0；was：试用剩 {N} 天；卖点：全部基础写作工具／不含 AI 能力／本地作品永久保留 |
| T1-5 | 付费卡 | 名称：包月／包季／包年；副行：{days} 天 · {devices} 台设备；主价：¥{整数} 元；was：原价 ¥{整数} 元（factor=1 不显示）；off 徽标：{9折/8折}；tag：最受欢迎；note：本月已有 {buyers} 人选择；卖点：含免费全部功能／AI 生成正文（流式）／设定与章纲融入 AI |
| T1-6 | 购买条 | 已选 {tier} · {period}（{days} 天）；已省 {N} 元；¥{xx.xx}；CTA：去支付 |
| T1-7 | 协议行 | 点击去支付后，将确认《购买协议》与《退款政策》要点（{version}） |
| T1-8 | foot | 全部写作功能 · 时长可囤，激活才开始计时 · 原路退款 |
| T1-9 | MAX 预告 | MAX · 即将推出 ／ 更高设备上限 · 更强 AI 能力。档位由后台配置上线——上线后此处自动变为可选时长与价格，无需改版。 |
| T1-10 | 恢复横幅 | 您有一笔未完成订单：{sku 摘要} · ¥{amount}，二维码有效期剩 {mm:ss} ／ 按钮：继续支付 |

### T1M 协议确认弹窗（双视图）

| # | 位置 | 文案 |
| --- | --- | --- |
| T1M-1 | 标题 | 确认购买协议 |
| T1M-2 | 引导 | 请阅读并确认以下要点： |
| T1M-3 | 要点 | ①一次性买断时长，到期不自动扣款 ②套餐支付成功即到货，点激活才开始计时；未激活可全额退 ③退款按剩余时长计算、原路退回，不影响其他套餐 ④本单：{sku 摘要} · ¥{amount} |
| T1M-4 | 全文入口 | 全文：《购买协议》（{version}）·《退款政策》（{version}） |
| T1M-5 | 打钩 | 我已阅读并同意《购买协议》与《退款政策》：按剩余时长折算退款、原路退回 |
| T1M-6 | 按钮 | 再想想 ／ 阅读并同意，去支付 |
| T1M-7 | 全文视图 | 标题：购买协议／退款政策；返回确认；正文=constants/agreement.ts（原型 `<template id="doc-*>` 六条逐字，含版本行「版本 v2026.08 · 生效日期 2026-08-01」） |

### T2 收银台 · 等待支付（waiting / waitFail）

| # | 位置 | 文案 |
| --- | --- | --- |
| T2-1 | h1/sub | 微信扫码支付 ／ 订单号 {orderNo} · {sku 摘要} |
| T2-2 | info notice | 请使用微信扫描二维码完成支付。¥{amount} 支付成功后套餐立即到货，激活后开始计时。 |
| T2-3 | 倒计时/按钮 | 二维码有效期剩 {mm:ss} ／ 取消支付 |
| T2-4 | 帮我查行 | 已扫码付款但页面没变化？我已支付，帮我查一下到账 |
| T2-5 | waitFail warn | 查过了：微信显示本次支付未成功（如余额不足、银行卡限额，或您取消了支付）。二维码仍然有效——请重新扫码，或在手机上更换支付方式后重试。 |
| T2-6 | waitFail 尾行 | 反复失败？取消本单，重新下单 · 或 联系客服 |
| T2-7 | NOTPAY info（原型未呈现，PRD §7 口径，OQ3） | 未查到支付记录，稍候再查 |

### T3 收银台 · 终态面板

| # | 态 | 文案 |
| --- | --- | --- |
| T3-1 | paid | h1 支付成功；sub 订单号 {orderNo}；serif：{period} · 已到货，待激活；说明：点「立即激活」马上开始计时；先存着也随时可在「我的套餐」激活；kv：支付金额 ¥{amount}／获得时长 {days} 天／生效方式 激活后，接在试用结束后开始／支付方式 微信扫码支付／协议确认 {version} · 已同意（{hh:mm}）；按钮：立即激活／返回控制台；lnk：先存着，之后在「我的套餐」激活 |
| T3-2 | closed | h1 订单已过期；sub 订单号 {orderNo} · 超过 15 分钟未支付，订单已自动过期；warn：本次订单未支付成功，没有产生扣款。重新下单将按当前价格生成新订单。；panel：{sku 摘要}· 下单时价格 ¥{amount}；按钮：重新下单；lnk：对价格有疑问？看看当前活动说明 |
| T3-3 | failCreate | h1 订单创建失败；sub 未产生任何扣款，您可以重试或返回重选套餐；err：网络波动或支付服务暂时不可用，本次未能生成支付二维码。没有产生扣款，请重试。；按钮：返回重选／重试；lnk：反复失败？联系客服 |
| T3-4 | failVerify | h1 支付核对中；sub 订单号 {orderNo} · {sku 摘要}；err：已收到您的支付，系统正在核对金额，暂未到账。资金安全、不会丢失——请勿重复支付。；panel：核对一般几分钟内完成；完成后套餐自动到账，可在「我的套餐」激活。／超过 30 分钟未到账，请携带订单号联系客服人工处理。；按钮：联系客服／查看我的订单 |
| T3-5 | 态〇 login | h1 登录后继续购买；sub {sku 摘要} —— 您的选择已保留；字段：用户名／密码；按钮：登录并继续购买；尾：还没有账号？注册即送 7 天全功能试用 · 忘记密码；lnk：‹ 暂不购买，先逛逛 |

### T4 控制台首页（console.html）

| # | 位置 | 文案 |
| --- | --- | --- |
| T4-1 | page-head | 你好，{username} ／ {yyyy 年 M 月 d 日 · 星期X} ／ 续费或购买时长（试用态：购买套餐，继续使用） |
| T4-2 | 退款横幅 | 您有一笔退款正在处理中（预计退 ¥{amount}，一般数分钟至 3 个工作日到账）。查看进度 |
| T4-3 | 试用横幅 | 试用还剩 {N} 天。到期后回到免费版：本地作品与数据不受任何影响，AI 与高级功能需购买套餐继续。看看套餐 |
| T4-4 | 我的套餐卡 | 生效中（pill-ok）／试用 · 剩 {N} 天（pill-warn）；{tier} · {period} · {devices} 台设备；{N} 天剩余；最远到期 {date} · 正在消耗：{period}（剩 {N} 天），{period2}已排队；查看套餐明细／购买套餐 |
| T4-5 | 我的设备卡 | 额度按已购最高档计算；{used}/{limit} 台；{设备行摘要}；管理设备；试用态补：购买后额度提升：包月/包季 3 台、包年 5 台 |
| T4-6 | 下载卡 | 下载爱小说客户端；在客户端里使用全部写作功能；套餐时长与设备额度与网页端同步。；Windows 版／macOS 版；v{X} · 约 {N} MB |
| T4-7 | 账户卡 | 我的账户；账号 {username} · 注册于 {date}；修改密码／退出登录 |

### T5 订单列表 / 订单详情

| # | 位置 | 文案 |
| --- | --- | --- |
| T5-1 | 列表头/尾/空态 | 我的订单 ／ 全部订单（含等待支付、退款中、已过期等各类状态）都在这里，可对任一订单单独申请退款；点订单查看详情与全部操作。／ 购买或续费；尾 notice：退款按剩余时长折算、原路退回；退某一单不影响其他套餐的起止时间。见退款政策。；空态：还没有订单／购买套餐后，订单与时长明细会展示在这里。／去购买套餐；行：详情 › |
| T5-2 | 详情状态说明条（六态） | paid：套餐已到货。计时从 {date} 开始；未激活前可全额退。waiting：订单 15 分钟内有效，超时自动过期。二维码请在等待支付页查看。refunding：退款已受理，原路退回中；套餐已冻结停止使用。到账后本单转为已退款。refunded：退款已完成，原路退回您的微信；对应套餐已收回，其他套餐不受影响。expired：超时未支付自动过期，未产生扣款。重新下单按当前价格生成新订单。verify：已收到您的支付，系统正在核对金额，暂未到账。资金安全、不会丢失——请勿重复支付。核对完成将自动到账。 |
| T5-3 | kv 标签 | 套餐／支付金额／下单时间／支付时间／微信支付单号（小字：对账/投诉时提供给客服）／协议确认（{version} · {hh:mm} 已同意）／套餐起止 |
| T5-4 | 时间线头 | 订单流程 —— 每个环节均记录状态变化时间（进行中环节为预计时间）；单号可在对账或投诉时提供给客服 |
| T5-5 | 时间线节点词 | 下单／等待支付／支付成功 ¥{amount}／套餐到货（已激活，计时中）· 剩余 {N} 天／申请退款（折算 ¥{amount} · 剩余 {text}），套餐已停止使用／微信原路退回中（预计 {date} 前到账）／退款到账，流程完成／超时未支付，订单已过期（未产生扣款）／金额核对中，已冻结／核对通过后套餐自动到货／流程完成 |
| T5-6 | ops/尾注 | 各态按钮见 §3.5 表；尾注：有疑问？联系客服（请提供上方订单号） |

### T6 退款流（refund.html）

| # | 态 | 文案 |
| --- | --- | --- |
| T6-1 | preview | 申请退款 ／ 退款按剩余时长折算，原路退回您的微信。本操作只影响这一笔订单。；kv：订单号／支付时间／实付金额／套餐时长／剩余时长（{d 天 h 小时 m 分}）；¥{amount} 预计退款（原路退回）；rule：按剩余时长计算退款，精确到秒，金额四舍五入到分；未激活或排队中（未消耗）的套餐退款为全额。以您点确认的这一刻为准计算剩余；确认后套餐立即停止使用。；按钮：确认退款金额，继续／先不退了；lnk：看看退款政策全文 |
| T6-2 | confirm 弹层 | 确认退款；kv：订单号／实付金额／剩余时长／退款金额；rule：提交后：对应套餐立即停止使用；退款原路退回您的微信，一般数分钟至 3 个工作日到账。（发票句暂缓删除，OQ11）；按钮：再想想／确认退款 |
| T6-3 | processing | 退款处理中 ／ 订单号 {orderNo}；已受理，正在退回 ¥{amount}；原路退回您的微信，一般数分钟至 3 个工作日到账；当天支付当天退，可能稍晚，款项不会丢失。；kv：折算基准 {datetime}（您确认退款时）／套餐使用 已停止；返回我的订单 |
| T6-4 | refunded | 退款完成 ／ 订单号 {orderNo}；¥{amount} 已原路退回；{datetime} 退回微信 · 对应套餐时长已收回；kv：其他套餐 不受影响，按原起止继续／套餐功能 如无其他套餐，已回到免费版；返回我的订单；notice：需要继续使用套餐功能？随时可以重新购买套餐，时长从头计算。 |
| T6-5 | reject-fen | 这笔订单剩余约 {10 分钟}，折算金额不足 1 分钱，无法发起退款。；订单即将到期，剩余时长可直接用完；返回我的订单 |
| T6-6 | reject-window | 这笔订单支付已超过 1 年，超出微信退款通道的受理窗口，无法在线退款。；如确有特殊情况，客服会帮您看还能怎么处理；联系客服 |

### T7 我的套餐 / 我的设备

| # | 位置 | 文案 |
| --- | --- | --- |
| T7-1 | 我的套餐头 | 我的套餐 ／ 档位按已购最高档计算，时长按购买顺序先后消耗。（免费态：购买后，套餐的使用情况与历史会展示在这里。）／ 续费或购买时长（免费态：去购买套餐） |
| T7-2 | 汇总行 | 剩余合计 {N} 天（已激活）· 最远到期 {date} · 待激活 {N} 个（{days} 天） |
| T7-3 | 信息 notice | 已激活的包年即刻把设备额度提升到 {N} 台；当前正在消耗{period}时长，{period2}到期后{period3}自动接上。您还有 {N} 个套餐待激活——不计时、不占额度，想囤着随时激活。 |
| T7-4 | 时间线行词 | {名称} · {N} 天 + pill（消耗中／已激活 · 排队中／已耗完／**退款冻结**〔pill-warn〕）+ dates（{起止} · 剩 {N} 天／已耗完） |
| T7-5 | 待激活区块 | {tier} {period} · {N} 天 + pill-accent 待激活 + {date} 支付 · 激活后才开始计时，未激活可全额退 + 立即激活 |
| T7-6 | 设备摘要尾注 | 额度按已激活最高档计算（{period} = {N} 台）；待激活套餐不占额度。管理全部设备 · 换设备怎么办？（免费态：试用与免费版限 1 台设备；购买后：包月/包季 3 台、包年 5 台。对比各档位） |
| T7-7 | 我的设备页 | 我的设备 ／ 套餐在设备上登录后自动绑定；解绑后原设备立即失去同步能力。；{used}/{limit} 台已绑定 · 额度按已激活最高档（{tier} {period}）；notice：换新电脑？直接在新设备登录会提示额度；解绑任意旧设备即可腾出名额，解绑即时生效。；行：当前设备（pill-ok）／解绑；尾注：免费版与试用限 1 台；PRO 包月/包季 3 台、包年 5 台。查看我的套餐 |
| T7-8 | 解绑弹窗 | 解绑设备 ／ 解绑后「{hostname}」立即失去同步能力；额度即时释放。确定解绑？ ／ 再想想 ／ 确认解绑 |

### T8 C端 提示条

| # | 规则 | 文案 |
| --- | --- | --- |
| T8-1 | verify_pending | 支付核对中：您近期一笔支付正在核对金额，请勿重复支付。查看订单 |
| T8-2 | refund_processing | 退款处理中：退款将原路退回您的微信，一般数分钟至 3 个工作日到账。查看进度 |
| T8-3 | 剩余 ≤7 天 | 套餐还剩 {N} 天，到期后本地作品不受影响、AI 功能需续费继续。去续费 |

### T9 通用 toast / 错误

| # | 场景 | 文案 |
| --- | --- | --- |
| T9-1 | 激活成功 | 已激活，接在 {最远到期日} 后开始 |
| T9-2 | 取消订单成功 | 已取消支付，可重新下单 |
| T9-3 | 复制失败 | 复制失败，请手动记录 |
| T9-4 | 订单不存在 | 订单不存在 |
| T9-5 | 网络错误兜底 | 网络连接失败，请稍后重试（沿用现有 request.ts 文案族） |

---

## 8. 设计令牌与词汇纪律

### 8.1 令牌纪律（H6）

- 颜色/字体/圆角/阴影：只引用 `base.css` 既有 var（`--bg/--surface/--fg/--muted/--border/--accent*/--ok*/--warn*/--err*/--fg-soft/--on-accent/--shadow-card/--font-display|body|mono/--radius|radius-lg`）。**不新增任何色相**；派生色只允许 `color-mix(...)` 组合既有 var。
- 文本灰度/透明度档位遵守 design-vocab `allowedOpacity`；金额与单号一律 `.num`；标题衬线 `.serif`/`--font-display`。
- 原型的评审切换器（`.switcher`）是**非基线元素**：实现不建此组件（ADJUSTMENTS 首条登记）。

### 8.2 类名契约（照抄原型 + 本地 CSS 落位）

- 共享词汇（@cross 段，直接用）：`.btn(+primary/secondary/ghost/sm/xs/lg)`、`.panel(+hoverable/hl/compact)`、`.pill(+tag/status/ok/warn/err/accent)`、`.notice(+info/ok/warn/err)`、`.scrim/.modal/.mcard*`、`.field/.input/.f-err/.f-hint`、`.empty`、`.appbar/.main/.page-head`、`.seg`、`.lnk`、`.num/.serif`、`.toast`。
- 原型专用**布局工具类**（不做视觉决策，色/圆角/字全走 var）落 S端 本地 CSS，**不进 @cross 段**、不动共享段：
  - `design/pay.css`（新）：`.back/.brand`（流程页）、`.tabs`（档位）、`.cards/.card/.tag/.off/.p-name/.p-days/.p-price/.p-was/.p-note/.p-feat`、`.purchase/.sel/.pay/.cta/.agree/.foot`、`.max-preview`、`.stage-narrow/.qr-stage/.qr-box/.countdown/.done-mark/.kv`、`.terms/.terms-agree/.doc-body`；
  - `design/dashboard.css`（扩）：`.order-row/.order-main/.order-title/.order-sub/.order-amt/.summary`、`.tl/.tl-bar/.seg-past|.now|.future/.tl-rows/.tl-row/.tl-dot/.tl-mark(.done|.now|.todo)`、`.tier-hero/.sum/.dev-row/.quota-head/.refund-hero/.rule-note/.wx-no/.copy`、首页 `.cards/.card .row/.big/.metric/.meta/.ops`。
- 新组件**不包新 CSS 档位**：组件 `<style scoped>` 只写布局（grid/flex/间距/宽度），视觉一律挂上述类名（AppCard/AppButton 模式）。跨端推论（cross-end §四）：同一 HTML 片段贴进任一端渲染逐像素相同。

### 8.3 词汇禁令

- 状态语气只有 `info/ok/warn/err`（**无 success/danger**）；toast 类型走现有 store 的 success/error/warning/info（其 DOM 类为 ok/err/warn，不新增措辞）。
- 状态词表（用户可见）以 §7 抄录为准：等待支付/已支付/退款中/已退款/已过期/核对中/待激活/已激活 · 排队中/消耗中/已耗完/生效中/当前方案/当前设备。**禁**：「已关闭」（改已过期）、「已冻结」（改核对中）、「折算」（改按剩余时长计算）、「设备额度」（改我的设备）、「我的 PRO」（改我的套餐）、「激活码/兑换码/输码」（整体退役）、「退订」（不存在，只有退款+权益回收）。
- **PRO 仅作档名**（PRO · 包年），禁作「付费」同义词（PRD §一·五）。
- 禁广告法绝对化用语（「最受欢迎」需人数依据、「最优惠/全网最低」禁）。

### 8.4 design:lint 通过口径

- 扫描范围：`src/**/*.{vue,ts}` 全量严格（含全部新文件）。
- 红线：未登记 Tailwind 任意值 `[...]`、档位外 opacity、原生色板类、裸 hex/`rgb()`、emoji/dingbats（✓✦ 等；SVG path 走 icons 注册表）、daisyUI 语义类、退役类 `.b/.strip`。
- 通过标准：`npm run design:lint` 退出码 0；连带 `npm run design:cross` 保持 0 差异（本设计**不改动 @cross 段**，cross 天然绿）。
- 新增图标（时钟/对勾/二维码角标等）补进 `ui/icons.ts` 注册表，path 照抄原型 SVG。

---

## 9. e2e 设计

### 9.1 Mock 扩展（沿用 fixtures auto 模式）

`e2e/mocks/api-handlers.ts` 的 `MockApi.routes` 追加（注意 Playwright 后注册优先，兜底 `/api/` 谓词拦截已在，漏出即 code 1）：

```
'**/api/pay/skus'           '**/api/pay/membership'      '**/api/pay/grants/activate'
'**/api/pay/orders'         '**/api/pay/orders/pending'  '**/api/pay/orders/*'
'**/api/pay/orders/*/query' '**/api/pay/orders/*/cancel'
'**/api/pay/orders/*/refund-preview'  '**/api/pay/orders/*/refund'  '**/api/pay/orders/*/refund/cancel'
```

（`orders/*` 通配须先于 `orders/pending` 注册或在 handler 内按 pathname 精确分发——照抄现有 handler 的 pathname 分发模式。）

新增 `MockApi.pay` 状态机（`e2e/mocks/pay-state.ts`）：

- `payState: { orders: Map<orderNo, PayOrderFixture> }`；`createOrder()` 落 pending+code_url+expires_at(+15min)。
- 场景开关：`setPayScenario('waiting'|'paid'|'closed'|'verify'|'failCreate')`（控制 createOrder/首查返回）；`markPaid(orderNo)`（测试内手动推动 pending→paid→fulfilled，模拟回调）；`markClosed/markVerify` 同理。
- `queryState` 可编程（SUCCESS/NOTPAY/PAYERROR）驱动 waitFail 用例。
- `refundPreviewFixture`（可退/不足 1 分/超窗三档）与 `refundResultFixture`（processing/refunded）。
- `test-data.ts` 增 `createTestOrder()/createTestGrant()` 工厂。

### 9.2 新增 spec 清单

| spec | 覆盖 |
| --- | --- |
| `pay-cashier.spec.ts` | pick 态：档位 tab 切换（MAX 预告面板/时长区隐藏）、免费卡不可选、卡选中态与购买条联动、协议弹窗（打开重置打钩→未勾主按钮禁用→勾选启用→切全文视图→返回确认仍勾选→再想想关闭）、「去支付」成功跳 `/pay/order/:no`；未登录态〇：登录卡渲染+「您的选择已保留」+登录后原地进 pick；恢复横幅（pending 存在时）；failCreate：创建失败面板+重试/返回重选 |
| `pay-order-pay.spec.ts` | waiting：二维码渲染+倒计时存在+轮询请求发出（route 计数）+`markPaid` 后切已到货面板（含协议确认留痕行）+焦点落在「立即激活」；waitFail：`queryState=PAYERROR` 后内嵌 warn 文案出现且二维码仍在；NOTPAY info；closed 面板重新下单带 sku；verify 面板无重试按钮；取消支付回 /pay；**刷新恢复**：reload 后仍在 waiting 并恢复轮询；页面隐藏暂停（`page.evaluate(() => document.hidden)` 不可直接造——用 `page.context().newPage()` 抢焦点后断言请求计数停止，或单测覆盖 visibilitychange 逻辑，e2e 断言恢复可见时立即发一次查询） |
| `pay-orders.spec.ts` | 六状态行渲染（pill 类/金额/副行文案逐一断言）、空态、行点击进详情、pending 行倒计时文案 |
| `pay-order-detail.spec.ts` | 六态（mock 详情返回驱动）：状态 pill/notice 文案、kv 隐藏字段矩阵（expired 无支付时间/协议行/起止/微信单号）、时间线节点与打勾态、ops 按状态聚合（paid=申请退款+去我的套餐、waiting=继续支付+取消订单…）、微信单号复制（grant clipboard 权限，断言剪贴板值=完整单号+按钮文案变「已复制」）、waiting「继续支付」跳 `/pay/order/:no` |
| `pay-refund.spec.ts` | preview 数字与后端 fixture 一致；确认弹层 kv 与 rule 文案；确认后 processing 态；refunded 态；拒绝两类（reject-fen/reject-window 文案）；「先不退了」返回 |
| `pay-membership.spec.ts` | 付费态：hero 汇总、时间线三行（past/now/future 与 pill）+ frozen 行（pill-warn 退款冻结）、待激活区块「立即激活」→ grants/activate 请求 + 刷新；免费态：试用 hero+对比文案 |
| `guards.spec.ts`（扩展） | `/dashboard/orders`、`/dashboard/membership` 未登录跳 login；`/dashboard/license` redirect membership；`/pay` 未登录**不**跳转（渲染登录卡）；`/pay/order/:no` 未登录同上 |
| `dashboard-home.spec.ts`（更新） | 新首页：横幅两态、四卡、导航 5 项、激活码入口不存在（断言「激活新码」count=0）；devices.spec.ts 更新解绑弹窗用例 |

全部不依赖真实后端（H5）；现有 specs 中引用 LicensePage/激活码的用例随拆除同步更新。

---

## 10. 性能与可访问性

### 10.1 性能

- **路由懒加载**：全部新页面沿现有 `() => import(...)` 模式；`/pay` 与 `/dashboard` 天然分包（收银台是 C端 跳转落地页，独立 chunk 有利于首屏）。
- **skus 缓存**：5 分钟 store 缓存，避免刷新重拉；金额永远以服务端响应渲染（防篡改，PRD §7①）。
- **倒计时/轮询节流**：倒计时 1s 本地、轮询按 §4.4 节拍；页面隐藏全停。
- **二维码渲染**：`qrcode` 库按需 import（动态 `import('qrcode')` 进 pay chunk）。

### 10.2 轮询与计时器清理（硬规则）

- 一切 `setInterval/setTimeout` 挂在 `useOrderPolling`/QrStage 内，`onUnmounted` 统一 `stop()/clearInterval`；`visibilitychange` 监听同点移除。
- 组件卸载、路由离开（`onBeforeRouteLeave`）、订单终态三条件任一即停；「帮我查」节流计时器随 QrStage 卸载清理。
- 复制按钮的「已复制」回显 timeout 同样 onUnmounted 清理。

### 10.3 弹窗滚动锁定

- AppModal 现有 Esc/Tab 焦点圈/焦点还原保留；**补滚动锁定**：`watch(open)` 切换 `document.body.style.overflow = 'hidden'/''`（打开锁定、关闭还原，onBeforeUnmount 兜底还原）。协议全文 `.doc-body` 自滚动（`max-height:52vh; overflow-y:auto`）——弹窗外页面不跟滚。此改动全局生效且行为兼容（打开态锁定是纯增强），登记为实现注记。
- 多弹窗叠放（TermsConfirmModal 在收银台上）只有一个 modal 实例原则：协议弹窗与后续任何弹窗不并存。

### 10.4 键盘可达与读屏

- 档位 tab：`role=tablist/tab + aria-selected`，Tab/Shift+Tab 移动，Enter/Space 激活（原生 button）。
- 时长卡组：`role=radiogroup` + 单卡 `role=radio :aria-checked`（button 实现，左右箭头切换为增强项）；免费卡 `aria-disabled`。
- 状态 pill：纯文本（`<span class="pill">`），读屏可读文案本身；不依赖颜色单独表达状态（notice 均带文字）。
- 倒计时**不加** `aria-live`（每秒播报是灾难）；终态跃迁加 `role=status` 的视觉隐藏播报区或直接把焦点移到新面板主按钮（waiting→paid 移焦「立即激活」）。
- CopyableNo 复制按钮 `aria-label="复制完整单号"`；二维码 `.qr-box` 加 `role="img" aria-label="微信支付二维码"`。
- `:focus-visible` 焦点圈由 base.css 全局提供；确认弹窗 checkbox 为原生 input（label 关联）。

---

## 11. Open Questions

> 以下为事实源未覆盖或相互冲突的点，需用户/评审拍板；未拍板前不得自行决定进入实现拆分。

| # | 问题 | 背景与选项 |
| --- | --- | --- |
| OQ1 | **「取消退款申请」是否做？** | order-detail.html refunding 态 ops 有「取消退款申请」，但 PRD 状态机无 refund 取消转移，且冻结式退款定版「确认即契约成立、失败也不解冻」。选项：A 删按钮（与冻结语义一致，推荐）；B 支持 pending 未受理前可取消并解冻（需后端加转移+解冻语义）。 |
| OQ2 | **收银台对外 URL 契约** | C端 功能墙/到期条/外链要写死 S端 入口。本设计取 `/pay?sku={sku_id}`。确认路径名（/pay vs /checkout vs /buy）与参数格式，一经 C端 写入即冻结。 |
| OQ3 | **「帮我查」NOTPAY 反馈的呈现** | PRD §7 有「NOTPAY → info『未查到支付记录，稍候再查』」口径，但原型未呈现此形态。确认：内嵌 info notice（本设计采用）还是仅按钮旁短提示？文案是否用 T2-7？ |
| OQ4 | **订单列表分页与排序** | PRD 未定义。默认：创建时间倒序、暂不分页（一次全量，接口预留 page/page_size）。订单量预期多大？超过多少需要分页/按状态筛选？ |
| OQ5 | **session.tier 语义迁移与 appbar pill 口径** | 现状 tier=monthly/quarterly/yearly（时长当档）；重构为 tier(PRO/MAX)×period 后 `tierDisplay` 映射表需重写。appbar pill 显示什么：档名「PRO」、时长「包年」、还是档+时长？原型各屏不一（console 常规态「包年」/membership「PRO」）。 |
| OQ6 | **收银台内登录失败的错误呈现**与注册回跳 | 登录失败用卡内 `.f-err` 还是 toast？「注册即送 7 天全功能试用」注册完成后是否直接回 `/pay?sku=…` 继续购买（注册即登录态，本设计假定是）？ |
| OQ7 | **微信单号脱敏规则与完整值下发** | 脱敏格式按原型 `4200****7721`（前 4 后 4）？完整单号经属主鉴权接口下发给前端供复制，是否接受（PRD B4 只防遍历，未禁下发）？ |
| OQ8 | **「最受欢迎」数据来源** | 人数=orders 近 30 天统计、<50 不展示（ADJUSTMENTS）。由 skus 接口一并返回（本设计）还是独立统计接口？MAX 上线前 popular 恒为 yearly 是否符合预期？ |
| OQ9 | **C端 days_remaining 口径** | 北京自然日取整（23:59 到期当天算 1 天）还是「剩余秒/86400 向下取整」？trial/free 是否返回 null？提示条可关闭后的重显规则（状态变化重显，本设计）是否符合预期？ |
| OQ10 | 【已拍板 2026-08-29】「立即激活」直接跳转「我的套餐」 | grillme | 到货页原地变已生效（本设计）还是跳「我的套餐」？待激活区块激活后是原地刷新还是跳转？ |
| OQ11 | **发票暂缓期的退款文案** | 确认弹层「已开票订单将同步处理发票冲红」句在暂缓期删除、恢复发票时加回——确认此文案随功能开关联动（本设计）还是永久改写。 |
| OQ12 | **时间线交互细节** | 订单详情 waiting 态时间线的实时倒计时（「二维码有效期剩 06:12」）是否做实时刷新（本设计：做，1s）；我的套餐时间线行是否可点击跳订单详情（本设计：可点，仅已支付行）。 |
| OQ13 | **「立即激活」的并发与二次确认** | 激活是无破坏动词语义（解禁计时），本设计不加确认弹窗、按钮 loading 防重复。确认无需二次确认。 |
| OQ14 | **倒计时到 0 的本地行为** | 本地时钟到 0：显示「已过期」+ 最后一次服务端查询官宣 closed（防时钟偏差）。确认此兜底，还是纯等服务端 closed（期间显示「查询中」）？ |

---

*本文档自包含；实现 change（s-wxpay-native）拆任务时，§3 组件树 → 组件任务、§4/§5 → api/store 任务、§7 → 常量文件任务、§9 → e2e 任务、§8.4 → 门禁任务，一一对应。*
