# Design · c-static-home

## Context

`/` 现状渲染 `LandingPage`（整页营销稿，自带 mkt-nav/mkt-foot，Navbar/Footer 在 `/` 让位）。用户裁定 v2：`/` = 免登录静态入口卡，已登录自动跳书架。设计稿已过稿（`docs/ux/home.html` home 态）。`landing.css` 的 `mkt-*` 仅 LandingPage 使用。`NovelListPage.upgradeBtn` 的兜底分支跳落地页定价区块，定价删除后必须改道。

## Goals / Non-Goals

**Goals**：`/` 成为免登录入口卡；已登录零营销；孤儿样式清理；升级兜底改道不断链。
**Non-Goals**：书架三态（`.resume` 继续创作条/首启空态/满额墙——等品牌意见另批）；S端 任何改动；品牌视觉迭代（本次是「占住」，不是终稿）。

## Decisions

1. **登录态判定用 `isLoggedIn()`（@/lib/auth）**：与 Navbar/LandingPage 现役口径一致，本地 token 存在性判断，无网络依赖——首帧即可分流，无闪屏。备选异步 `/auth/me` 校验——引入启动阻塞，否决（token 失效由既有 API 401 自愈链路兜底）。
2. **分流组件内联在 `App.tsx`（`HomeGate`）**：三行逻辑不值得单独文件；与既有 `RedirectToNovel` 同模式。
3. **Navbar 未登录变体**：默认 appbar 分支内 `!loggedIn` 时隐藏导航链接与设置、显示「登录」（ghost）+「免费开始」（primary）。登录后保持现网口径。workbench 变体不受影响（`/novel/` 分支在前）。
4. **`landing.css` 整体替换为 `.welcome` 段**：文件名与 import 链不动，内容从 mkt-* 换成 welcome 卡。`.welcome` 为 C端 私有类，落本地段不进 `@cross`（S端 无此页，无双端同批义务）；ADJUSTMENTS.md 登记。
5. **`upgradeBtn` 兜底改 `PORTAL_URL` 常量**：该常量即 lib/portal 注释写明的「未登录页兜底值」；动态 `portalUrl`（/auth/config）优先级不变。跳转外链语义不变，不新引入安全面。
6. **Footer 仅去掉 `/` 让位**：保留 `/novel/` 让位（工作台无页脚是既有设计）。

## Risks / Trade-offs

- **品牌后续迭代**：本批是占位实现，品牌设计 agent 意见回来后 `.welcome` 文案/视觉可能再调——CSS 已收敛在单文件，改动面小。
- **直接访问 /config（未登录）**：不在本批范围（既有行为保留），Navbar 未登录变体下该页无导航链接可回——与设计稿一致（未登录世界只有：首页/登录）。
- **e2e**：无 spec 引用落地页内容；涉 `/` 路由的用例（若有）在回归中确认。

## Open Questions

无。
