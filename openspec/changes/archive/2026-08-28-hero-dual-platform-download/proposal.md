## Why

v0.1 发布后落地页 Hero 仍是 Windows-only 口径；同时用户拍板废弃"固定名副本 + latest 直链"机制，改为**版本号全面显式化**：Release 资产只保留带版本号原件，落地页按钮直接链接带版本号的资产直链。理由：用户下载到手的文件名、Release 页、落地页三处版本号一致，无"魔法 latest"心智负担。布局方案 A（双平台直下载按钮）维持 2026-08-27 的拍板。

## What Changes

- CI（`client-package.yml`）：release job 删除「复制固定命名副本」步骤，Release 资产收敛为 2 个带版本号原件；Release body 同步改写（去掉固定名直链说明）。
- 落地页 Hero 未登录态双按钮：「下载 Windows 版」（primary）+「下载 macOS 版」（secondary 同权重），href 由版本常量拼接为带版本号资产直链 `releases/download/v<VER>/AI_Novel_Setup_v<VER>.exe` / `AI_Novel_mac_<VER>.dmg`。
- 版本号单一事实源：S端 前端新增常量（如 `src/config/latestClientVersion.ts`，`LATEST_CLIENT_VERSION = '0.1'`），按钮 href 与副行「v0.1 · 支持 Windows 与 macOS · 注册即送 7 天试用」都从它取值。
- 发版同步自动化：release job 发完 Release 后自动开「bump 落地页版本号」PR（改动仅该常量一行）；合入即走既有 S端 push-main 自动部署。忘合入时落地页指向上一版资产（旧资产永存，链接不失效，仅版本滞后）。
- Hero 新增次级链接「其他版本 →」指向 Releases 页，保留浏览全部版本出口；登录态「进入控制台」不变。
- 规格：MODIFIED「落地页下载入口」（latest 固定名直链 → 版本化直链 + 版本常量）；REMOVED「固定命名稳定直链」（机制整体废除）。

不在本变更范围：激活指引文案、其余落地页区块、C端 文件、v0.1 存量 Release 的固定名资产清理（历史 Release 不回改）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `installer-release`: 「落地页下载入口」需求改为版本化直链按钮 + 版本常量单一事实源；「固定命名稳定直链」需求整体移除。

## Impact

- `.github/workflows/client-package.yml`（删副本步骤、body 改写、新增 bump-PR 步骤）。
- `server/frontend/src/components/landing/HeroSection.vue` + 新增 `src/config/latestClientVersion.ts`。
- `openspec/specs/installer-release/spec.md` 经 delta 归档后更新。
- 发版 SOP 变化：以后每个 v* tag 发布后会多一个自动 bump PR，需要人合入。
- 无 C端 改动、无 API 契约变化；落地页改动合 main 即自动部署。

## Design Impact

- 受影响端：S端（HeroSection 单屏）+ CI（无 UI 面）。
- 对象状态：按钮沿用 .btn 既有形态，无新增状态语言。
- 共享段：不触碰；图标沿用两端公共键 `download`，path 不变，不新增品牌 glyph（stroke 体系一致性，见 design D3）。
- 原型先行：免（纯 S端 微改），实现后附登录/未登录两态截图。
- 文案规则：按钮动词起句；副行含版本号（来自常量，非硬编码散值）；补救语句带出口（「其他版本 →」）。
- 设计工件：实现侧自查（design:lint + build + 截图对照）。
