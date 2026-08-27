# installer-release 变更规格

## MODIFIED Requirements

### Requirement: 落地页下载入口

S端 落地页 SHALL 提供可达的客户端下载入口：未登录态 Hero 区 MUST 并列呈现 Windows 与 macOS 两枚下载按钮，均以动词起句，href 分别指向本仓库（owner 为 `modoojunko`）对应最新正式版 Release 的**带版本号资产直链**（`releases/download/v<VER>/AI_Novel_Setup_v<VER>.exe` / `releases/download/v<VER>/AI_Novel_mac_v<VER>.dmg`）。双平台资产文件名 MUST 统一以小写 `v` 前缀标注版本。`<VER>` MUST 取自 S端 前端的版本号单一事实源（常量），落地页各处展示与链接的版本号 MUST 同源；MUST NOT 出现第二处独立维护的版本字面量。Hero 区 MUST 另提供指向 GitHub Releases 页面的次级链接作为浏览全部版本的出口。下载区副行文案 MUST 为双平台口径并展示当前版本号（同源自常量）。已登录态 SHALL 保持「进入控制台」主操作不变，不渲染下载按钮组。激活指引第 1 步 MUST 同时写明双平台获取方式。代码库内 MUST NOT 出现拼写错误的仓库 owner 或死链式下载入口。

#### Scenario: 未登录访客点击 Windows 下载按钮
- **WHEN** 未登录访客打开落地页并点击「下载 Windows 版」
- **THEN** 浏览器开始下载 `releases/download/v<LATEST>/AI_Novel_Setup_v<LATEST>.exe`（`<LATEST>` 为版本常量值），文件名带 `v` 版本号

#### Scenario: 未登录访客点击 macOS 下载按钮
- **WHEN** 未登录访客打开落地页并点击「下载 macOS 版」
- **THEN** 浏览器开始下载 `releases/download/v<LATEST>/AI_Novel_mac_v<LATEST>.dmg`，文件名带 `v` 版本号

#### Scenario: 版本号单一事实源
- **WHEN** 需要更新落地页所指客户端版本
- **THEN** 仅修改版本常量一处并重新部署，按钮 href 与副行版本展示同步生效，无第二处需要改动的字面量

#### Scenario: 访客从落地页进入下载
- **WHEN** 访客点击 Hero 区「其他版本」次级链接
- **THEN** 新开 `https://github.com/modoojunko/ai-novel/releases` 页面且存在（非 404），可浏览全部版本与历史版安装包

#### Scenario: 副行双平台口径
- **WHEN** 访客阅读 Hero 下载区副行文案
- **THEN** 文案同时提及 Windows 与 macOS，并展示来自版本常量的当前版本号

#### Scenario: 已登录访客的 Hero 主操作
- **WHEN** 已登录用户打开落地页
- **THEN** Hero 主操作为「进入控制台」，不出现下载按钮组

#### Scenario: 激活指引双平台口径
- **WHEN** 访客阅读激活指引「下载安装」步骤
- **THEN** 文案同时覆盖 Windows 安装包与 macOS DMG 的获取说明，未遗留"仅 Windows"表述

## REMOVED Requirements

### Requirement: 固定命名稳定直链

**Reason**: 用户拍板版本号全面显式化——Release 资产不再携带固定命名副本，`releases/latest/download/<固定名>` 机制整体废除；落地页改用带版本号的资产直链（见 MODIFIED 落地页下载入口）。发版同步由 release job 自动开 bump PR 兜底，漏合入时落地页指向上一版资产（旧资产永存不失效），无需固定名机制兜底。

**Migration**: 落地页与营销物料中如有 `releases/latest/download/AI-Novel-Setup-*.exe/.dmg` 引用，改指版本化直链；已发布的 v0.1 存量 Release 上的固定名资产不回改，随历史保留。
