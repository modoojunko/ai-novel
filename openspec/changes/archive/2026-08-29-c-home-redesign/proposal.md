# c-home-redesign · 静态首页重设计（OpenDesign 三变体评审）

## Why

c-static-home 上线的 welcome 入口卡被用户评「太丑」。按 OpenDesign 原型规范重做静态首页，出三个设计方向（玄墨/卷首/朱印，slogan 均为用户定稿「人铸灵魂，AI 行笔墨」）供拍板。本 change 是设计评审 + 选定后实现；路由行为不变（`/` 免登录入口卡 + 已登录跳书架），无 spec 级行为变化（skip_specs）。

## What Changes

- 新增 `docs/design-c/prototypes/home.html`：三变体交互评审稿（OpenDesign 可直接渲染，右下角切换器）
- 用户选定变体后：`landing.css` 的 `.welcome` 段重写为选定稿、`LandingPage.tsx` 同步、选定变体转正为 home 页原型基线并回登 ADJUSTMENTS
- 品牌 agent 后续意见在此稿上迭代

## Capabilities

### New Capabilities

（无——纯视觉，无 spec 级行为变化，`.openspec.yaml` 已设 `skip_specs: true`）

### Modified Capabilities

（无）

## Impact

- 设计工件：`docs/design-c/prototypes/home.html`（新增）+ CLAUDE.md 页面清单 + ADJUSTMENTS 登记（已完成）
- 实现（选定后）：`client/frontend` 仅 `landing.css` + `LandingPage.tsx` 两文件；不触共享段；落地页非 parity 对象，既有基线零波动
- 无后端、无路由、无依赖变更

## Design Impact

- **受影响端**：仅 C端
- **屏/弹层清单**：`/` 静态首页（未登录）
- **对象状态**：登录/未登录两态不变；无新增状态语气
- **是否触共享段**：否
- **是否需要原型先行**：本 change 即原型先行本身（三变体评审稿已产出）
- **设计工件由谁产出**：设计侧会话（本轮）；品牌 agent 意见在此稿上继续迭代
