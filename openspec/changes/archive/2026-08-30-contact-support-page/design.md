# Design

## Context

S端 为 Vue 3 + vue-router，公开路由挂在 PublicLayout（`/`、`/login`、`/register`）；落地页页脚为 FooterSection.vue（内含 SiteBeianBar 备案条）。法律四件套已把客服邮箱 `alexee_zhu@163.com` 定为用户侧唯一出口。支付五原型为纯设计资产（未提交 git、停评审口），其中 5 处"联系客服"为 `href="#"` 占位。

C端 为 React 19（pywebview 壳）：Navbar 有两形态——列表屏 appbar（nav + 已登录区「设置」按钮）与工作台 appbar-wb（「我的小说」返回 + 「设置」按钮），对应原型 `docs/design-c/prototypes/list.html`、`book.html`。C端 已有外跳体系 `lib/portal.ts`：`fetchPortalUrl()` 从后端 `/auth/config` 拉门户地址并缓存（config.json 可覆盖，安装包场景 env 不注入），`isSafeExternalUrl()` 拒绝私有/环回地址；NovelListPage 已有 `target="_blank"` 锚点先例（pywebview cocoa 不认编程式 window.open）。本 change 在 S端 为纯静态信息页，在 C端 为单个外跳按钮，均无后端、无状态。

## Goals / Non-Goals

**Goals:**

- 用户从落地页页脚一步进入客服页，看懂"给谁写、写什么、多久回"
- C端 用户在顶栏一步跳到同一客服页，双端一个口径
- 邮箱地址、时限数字有单一事实源，后续支付界面等复用不散落
- 页面视觉复用既有语义类与 oklch 令牌，与各自端现有界面同族

**Non-Goals:**

- 不做在线工单、IM 客服、FAQ 知识库（占位阶段邮箱足够）
- C端 不做自有客服界面/弹窗/内嵌页，仅一个外跳按钮（用户拍板）
- 不承载法律协议全文展示（协议入口待律师审口径后另做）
- 不引入新组件词汇或共享段改动

## Decisions

### D1：路由与布局——PublicLayout 下新增 `/support`

免登录是硬需求（要退款的用户可能已退出登录）。挂 PublicLayout 与 landing/login 同族，不设 `guestOnly`（避免已登录用户被反向守卫弹去 dashboard）。落地页页脚用 `router-link` 站内导航。

备选：挂独立无布局路由（如 404 那样）——放弃，页脚导航条/备案条等公共壳更一致。

### D2：单一事实源——`server/frontend/src/constants/support.ts`

导出 `SUPPORT_EMAIL` 与时限常量（`SUPPORT_REPLY_HOURS = 48`、`PRIVACY_RESPONSE_WORKDAYS = 15`）。页面模板只引用常量，正文时限句由常量插值拼出；换邮箱/调口径改一处重发即可（与 site-beian 备案号同款哲学，但此处是代码内常量而非构建期环境变量——邮箱不随部署环境变化，无需进 CI Variables）。

备选：走构建期环境变量——过度设计，邮箱与部署环境无关。

### D3：mailto 直链 + 一键复制

邮箱渲染为 `mailto:` 锚点（无 target，邮件客户端接管）；旁附「复制邮箱」按钮（navigator.clipboard，降级 execCommand）。写邮件场景多在桌面端，mailto 命中率高；复制兜底网页邮箱用户。

### D4：场景化内容结构——分节卡片而非 FAQ 折叠

六个场景（退款/发票/注销/安全/个保权利/一般问题）各一小节：标题 + 要带的信息清单 + 对应时限。用既有 panel/语义类排版，不做折叠交互（内容量小，全展开扫读更快）。每节补救性文案（如"邮件写错退信"）带可点击出口回到 mailto。

### D5：原型死链替换——最小 diff

五原型中 5 处 `href="#"` 的"联系客服"统一改 `href="/support"`，不动其余结构；替换清单与文件定位记入 tasks，避免误伤其它 `#` 占位（如示例链接）。

### D6：C端 入口——Navbar 两形态各一个 ghost 外链按钮，地址复用 portal_url 体系

C端 主形态（列表屏）与工作台形态的已登录区、「设置」按钮旁各加一个「联系客服」`btn-ghost btn-sm` 锚点按钮（`target="_blank"` + `rel="noreferrer"`，走 NovelListPage 同款先例）。地址 = `fetchPortalUrl()` 结果去尾斜杠后拼 `/support`，经 `isSafeExternalUrl` 校验；portal_url 为空时按钮整体不渲染（沿用 MemberBlockPrompt 的降级哲学，绝不落到 `PORTAL_URL` 测试兜底域名——安装包场景该常量不可靠，见 SERVER_API_BASE 占位前车之鉴）。未登录形态不加（官网落地页页脚已覆盖，且未登录用户本在浏览器环境）。

备选一：PrefsModal 里加入口——藏太深，出问题的用户找不到，放弃。备选二：C端 自建客服弹窗（邮箱 + 复制）——违背"不做更重设计"拍板，且邮箱又得多端两份硬编码，放弃。

### D7：C端 原型先行——list.html 与 book.html 同步补按钮

按 C端 硬性流程先改两个原型的 appbar（「设置」旁加同款 ghost 链接，原型内 href 用 `#` 占位即可，落地时替换为真实地址），ADJUSTMENTS.md 登记偏差（按钮原样落地，预期零偏差），再动 src/。

## Risks / Trade-offs

- [个人邮箱当客服渠道，收件与身份核验能力有限] → 占位阶段接受；todo 已有独立客服邮箱（support@awesomenovel.com）的律师侧建议，升级时只改常量与协议
- [页面写死场景清单，协议改口径后页面漂移] → 时限数字走常量并在 tasks 里注明"与 docs/legal 同批修改"；归档后把"协议改版须同步客服页"写进 spec 已覆盖（时限一致 Requirement）
- [mailto 在部分 Linux 桌面无默认邮件客户端] → 复制按钮兜底，页面同时以纯文本展示邮箱
- [C端 portal_url 取不到时按钮消失，恰是用户最需要客服的时刻] → 接受：该状态意味着后端整体不可达（购买/激活同样不可用），用户仍可经官网落地页页脚到达客服页；不为边缘态引入 C端 邮箱硬编码
- [C端 appbar 加按钮挤压小窗宽度] → ghost 小按钮与「设置」同规格，appbar 已有 spacer 弹性区；原型先行 + design:check 像素门禁兜底

## Migration Plan

S端 纯新增路由与页面，无数据迁移；C端 纯新增按钮。部署即生效；回滚=删路由/链接/按钮。原型文件未入 git，改完即终态。C端 面向用户的本地验证依赖 `docker compose build` 重建容器（nginx 静态烤死，改源码不重建不生效）。

## Open Questions

（无）
