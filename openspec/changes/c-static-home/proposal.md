# c-static-home · 启动静态首页 + 登录态分流（批次二·home 占位）

## Why

用户裁定 v2（2026-08-29，推翻 docs/ux/home.html v1）：`/` 必须是**免登录可见的静态页**——能打开这个 App 的人必然已下载安装，不需要被介绍产品；此页只做登录/建号入口。现状 `/` 渲染整页营销稿（hero 光斑 + 痛点 + 定价），已登录用户每次启动都先看广告。本批先把 home 占住；书架三态（继续创作条/首启/满额墙）等品牌设计意见回来后另批。

## What Changes

- `LandingPage` 重做为 **welcome 入口卡**（设计稿 `docs/ux/home.html` home 态）：品牌方标 + 「登录后，开始你的第一本书」+ 一句实用信息 + 免费开始/我已有账号 + 免费口径注脚；删除全部营销段落（痛点/工作流/特色/定价）与其自带导航页脚
- `App.tsx` `/` 路由加登录态分流：已登录 → `<Navigate to="/novels" replace>`；未登录 → 静态首页（免登录可达）
- `Navbar` 删除 `pathname === "/"` 让位分支，新增未登录变体：无导航/设置，只显示「登录」+「免费开始」
- `Footer` 删除 `pathname === "/"` 让位分支（静态首页按设计稿带页脚）
- `landing.css` 整体重写：删全部 `mkt-*` 营销样式（仅 LandingPage 使用，本次成为孤儿代码），换 `.welcome` 入口卡样式
- 计划外连带：`NovelListPage` 的 `upgradeBtn` 兜底分支原跳落地页定价区块——定价已删，兜底改 `PORTAL_URL` 常量直连（设计稿步骤 3 的前置最小集）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `novel-workspace`: 路由收敛补充 `/` 的登录态行为——未登录渲染静态欢迎页（免登录可达），已登录重定向 `/novels`

## Impact

- 代码：`client/frontend` 6 文件（App/Navbar/Footer/LandingPage/landing.css/NovelListPage）
- **不触两端共享段**：`.welcome` 是 C端 静态首页私有类（S端 无此页），落 `landing.css` 本地段，不进 `@cross`；`design:cross` 复跑确认零差异
- 视觉：落地页非 parity 场景，`design:check` 既有基线（books/empty 等）零波动预期
- e2e：无任何 spec 依赖落地页内容（已 grep 证实）；涉路由断言需回归
- 依赖：先归档 `c-ux-stopgap-batch1`（本 change 的 spec delta 基于其归档后的 requirement 终态）

## Design Impact

- **受影响端**：仅 C端
- **屏/弹层清单**：`/` 静态首页（未登录）、全局 Navbar/Footer 登录态分支、书架升级按钮兜底行为
- **对象状态**：登录/未登录两态切换，无新增状态语气
- **是否触共享段**：否（`.welcome` 为 C端 本地类；ADJUSTMENTS.md 登记见 tasks）
- **是否需要原型先行**：设计稿即 `docs/ux/home.html` home 态（已用户过稿）；落地页非 parity 对象，`design:check` 全绿兜底
- **设计工件由谁产出**：设计侧会话（本轮已完成并过稿）；品牌设计 agent 后续意见另批迭代
