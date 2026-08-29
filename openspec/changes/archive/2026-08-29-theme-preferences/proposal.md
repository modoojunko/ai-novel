## Why

品牌色三轮评审结论修正：不做全站默认换色，**默认主题保持 teal 现状**，把换色能力产品化——用户可自选界面 accent 主题。偏好状态存 S端（用户体系所在端），接口设计为 C端 可直接复用，后续 C端 接入主题同步时零后端改动。上一分支 `feat/s-brand-ink-restyle` 的"默认玄墨"方向作废（分支不推）；其品牌资产（爱字印标、favicon、安装包图标）已随本分支带入。

## What Changes

- **主题机制**：两端 base.css `@cross` 段内新增 `:root[data-theme="<key>"]` accent 覆盖层（双端逐字同，design:cross 机器强制）；默认 = 无属性 = 现有 teal 基础值，**默认观感零变化**
- **预置主题集合**（6 个，数据可扩）：teal 默认 / ink 玄墨 / bamboo 竹青 / rouge 胭脂 / wisteria 紫藤 / celadon 青瓷，全部 oklch 定值并按色相登记纪律登记 docs/ux 词汇表
- **后端**：`users` 表加 `theme` 列（alembic 迁移）；`GET /api/user/me` 响应带 `theme` 字段；新增 `PUT /api/user/preferences`（body `{theme}`，白名单校验，非法值 422）
- **S端 UI**：控制台「账户与安全」页新增主题选择器（色板 swatch + 点击即时生效 + PUT 持久化）；登录拉取 me 后应用 `data-theme`，落地页/认证页保持默认
- **C端 预埋**：C端 base.css 同批落同一段覆盖层（契约要求）；C端 主题选择 UI 与同步逻辑为后续独立 change，本 change 冻结 theme key 契约
- 品牌资产（爱字印标玄墨版 favicon + 安装包图标）随本 change 入库；图标为死资产不随主题变，玄墨中性色与 teal 默认界面不冲突（可批，见 design D7）

## Capabilities

### New Capabilities

- `theme-preferences`: 用户级界面主题（accent）偏好的定义、存储、API 与前端应用机制——主题集合契约、服务端持久化、两端 CSS 应用层

### Modified Capabilities

- `design-system`: 共享令牌体系从单 accent 静态值扩展为「默认值 + data-theme 覆盖层」，色相登记口径由单色相变更为主题色相集合

## Design Impact

- **受影响端**：双端（@cross 段 CSS 层同批，契约强制）；S端 另有后端 + 控制台 UI 改动；C端 仅 CSS 预埋层（默认不激活、渲染零变化）
- **受影响屏/弹层**：S端 控制台 AccountPage（新增主题选择器区块）+ 登录后全部控制台页（accent 随主题）；landing/auth 固定默认。C端 全部屏理论上可被主题影响，但本 change 无入口激活（默认 teal）
- **对象状态**：不新增对象状态语言；主题选择器按钮遵循 btn 家族动词词表，选中态用既有 accent-soft
- **触碰两端共享段**：是（@cross tokens 段扩展 data-theme 覆盖层），design:cross 必跑
- **原型先行**：C端 默认零变化，原型无需改动（parity 应保持绿，作为回归验证）；S端 免原型，截图对照入 change 目录
- **设计工件产出方**：实现侧自查（色板已经用户三轮 HTML 评审，色值取自评审定稿）

## Impact

- `server/app/models/user.py`（theme 列）+ alembic 迁移 + `server/app/interfaces/web_api/account.py`（me 响应 + preferences 端点）+ application/domain 层偏好读写 + pytest
- 两端 `src/design/base.css`（@cross 段 data-theme 覆盖层）+ `npm run design:cross`
- `server/frontend`：session store 拉 me 应用主题、AccountPage 主题选择器组件、e2e（mock 层 + 交互用例）
- `client/frontend`：仅 base.css 同批覆盖层；parity/design:check 回归验证默认态零变化
- `docs/ux/cross-end.html`：色相登记簿改写为主题色相集合登记
- 无破坏性 API 变更（me 响应加字段、新端点均为增量）
