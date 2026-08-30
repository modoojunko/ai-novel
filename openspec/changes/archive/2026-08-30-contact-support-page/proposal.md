# contact-support-page

## Why

法律四件套（docs/legal/）把客服邮箱 `alexee_zhu@163.com` 定为用户侧唯一出口，承担退款申诉（48h）、账号注销（15 个工作日，个保法硬要求）、发票申请、个保权利行使等 7 类带时限承诺的职责；但当前两端产品内没有任何"联系客服"路径，用户在产品里找不到协议所指向的渠道。需要一个静态客服页占位，教用户如何写邮件，先把这个契约缺口闭上。

## What Changes

- S端 新增公开路由 `/support`（PublicLayout 下，免登录）：静态客服页，内容为"如何写邮件"
  - 客服邮箱展示 + `mailto:` 直链（点击拉起邮件客户端）
  - 按场景列写邮件要提供的信息：退款/订单（订单号、付款时间、诉求）、发票（订单号、抬头、税号）、注销账号（账号标识 + 明确注销请求）、账号安全（现象、最近登录时间）、个人信息权利（身份验证信息）、一般问题（客户端版本、系统、截图、复现步骤）
  - 响应时限口径与协议一致：一般 48 小时内回复；个人信息权利 15 个工作日
  - 邮箱地址与口径数字进单一事实源常量，页面不散落硬编码
- S端 落地页 FooterSection 增加「联系客服」链接，指向 `/support`
- C端 顶栏加轻量入口：主导航栏（列表屏）与工作台顶栏的已登录区，在「设置」按钮旁增加「联系客服」ghost 外链按钮，`target="_blank"` 新窗口打开 S端 `/support`；地址复用 C端 既有 portal_url 体系（后端 `/auth/config` 下发、`lib/portal.ts` 兜底与安全校验），不硬编码第二个域名；C端 不做自有客服界面
- 支付五原型（docs/design-s/prototypes/，未提交 git、停评审口）中 5 处 `href="#"` 的"联系客服"死链统一替换为 `/support`，保持设计资产与落地口径一致

## Capabilities

### New Capabilities

- `contact-support`: 双端客服联系路径——S端 免登录静态客服页及其站内入口（落地页 footer），与 C端 顶栏跳转入口；定义页面必须呈现的邮箱、场景化邮件要素与时限口径，及 C端 外跳地址来源约束

### Modified Capabilities

（无——不改任何既有 spec 的需求；不触碰 design-system，页面全部复用既有语义类与令牌）

## Impact

- 代码：`server/frontend/src/`（router 增路由、views 增 SupportPage.vue、constants 增邮箱常量、FooterSection.vue 增链接）；`client/frontend/src/`（Navbar.tsx 两形态增加外链按钮、lib/portal.ts 消费方）；C端 设计资产 `docs/design-c/prototypes/list.html`、`book.html`（appbar 增入口）+ `ADJUSTMENTS.md` 登记；`docs/design-s/prototypes/*.html`（死链替换）
- 不涉及后端 API、数据库、依赖变更；S端 纯静态信息页，C端 纯外跳链接
- 不触碰两端共享段（base.css 令牌与基础组件类）；C端 复用既有 btn-ghost 语义类，无新组件词汇
- 范围外（记入后续）：协议四件套在双端的展示入口与首启同意弹窗（待律师审口径一并定）；C端 更重的客服形态（工单/FAQ/应用内页，用户已拍板不做）；支付页面真实代码落地时引用 `/support`（随支付立项）

## Design Impact

- 受影响端：双端。S端 纯新增（免原型；按流程在 change 目录附渲染截图对照）；C端 涉既有屏微调（原型先行）
- 受影响屏/弹层：S端 新增 `/support` 屏（公开访问）、落地页 FooterSection 追加一条文字链接；C端 `list.html` 对应的列表屏 appbar 与 `book.html` 对应的工作台 appbar-wb，各在「设置」按钮旁追加一个「联系客服」外链按钮
- 对象状态：无新增对象状态（S端 纯静态信息页；C端 纯外跳，不涉及状态语言总表新条目）
- 两端共享段：不触碰
- 原型先行：C端 需要——先改 `docs/design-c/prototypes/list.html`、`book.html` 的 appbar 并在 `ADJUSTMENTS.md` 登记（按钮原样落地，预期零偏差）；S端 免原型
- 设计工件产出：实现侧自查（S端 无原型基线以两端渲染截图对照为证；C端 走 design:check 像素 parity）
- 文案口径遵循 design-language §13：按钮词必须是动词（「联系客服」）；不出现内部术语；时限等承诺数字与 docs/legal 四件套逐字一致；补救语句（如邮箱写错退信）带可点击出口
