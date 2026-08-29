# c-bookshelf-states · 书架三态（继续创作条/首启引导/满额锁定墙）

## Why

批次二收尾：书架 `/novels` 落地三态设计（`docs/ux/home.html` 回访/首启/满额，用户已过目），同时清掉审计 P0 的两个断裂项——免费用户零引导（#3）、书架满额隐藏入口（#4，正解=「锁定可见 + 一句话说明 + 升级出口」）。品牌 agent（Brand Guardian）已介入评审书架三态，意见随批吸收。

## What Changes

- **回访态**：书架顶部新增 `.resume` 继续创作条（`updated_at` 最大的书置顶，直达工作台）
- **首启态**：书架为空时渲染三步引导空态（新建作品 → 配置模型 → 开写第一章），替代现有单薄空态
- **满额态**：免费额度墙——顶部 `.notice.info` 说明 + 「新建作品/导入」按钮**锁定可见可点**（点击弹升级引导而非隐藏）+ 网格尾「升级锁卡」
- **文案纠偏**：免费额度事实源为 **1 部**（`require_project_limit`：免费/过期 1 个项目，会员不限）——设计稿与首页注脚的「3 部」全部纠正为 1（首页注脚已在本 change 前置修正）
- 品牌 agent 评审意见落地（与其结论同批）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `tier-gating`: 免费额度墙的前端行为——入口锁定可见（带锁图标仍可点击），点击引导升级，而非隐藏入口

## Impact

- 代码：`client/frontend` 的 `NovelListPage.tsx`、`list.css`（.resume/.first-run/.lock-tile 三组新组件样式，C端 私有段）；升级引导复用既有 UpgradeModal/portal 链路
- 不触共享段；`.resume` 等三组类按 ADJUSTMENTS 登记
- 视觉：书架既有 parity 基线（books/empty 场景）零波动预期——回访态在现有基线之上新增元素，**若基线场景截到继续创作条则须先动 list.html 原型**（见 design 风险）
- e2e：满额分流既有 stub（devices/current）口径不变

## Design Impact

- **受影响端**：仅 C端
- **屏/弹层清单**：书架三态（回访/首启/满额）
- **对象状态**：loading 骨架、空态、满额锁定态；语气全走 info（notice），无新增
- **是否触共享段**：否
- **是否需要原型先行**：设计稿 `docs/ux/home.html` 三态已在；书架像素基线若受影响按红线先改 `list.html` 并登记
- **设计工件**：设计侧已产出 + 品牌 agent 评审中（结论同批落地）
