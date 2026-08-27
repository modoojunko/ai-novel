# installer-release 变更规格

## Purpose

让公网用户能真正下到 C端 客户端：v* 标签推送自动把双平台安装包发布到 GitHub Releases 并提供不随版本号变化的稳定直链，S端 落地页的下载入口指向正确地址且覆盖 Windows 与 macOS 双平台。

## ADDED Requirements

### Requirement: v* 标签自动发布双平台安装包

系统 SHALL 在推送 `v*` 标签时自动构建 Windows 安装包与 macOS DMG，并把两者挂载到该标签对应的 GitHub Release 上。每个此类 Release 的资产 MUST 同时具备两种平台的安装包；缺任一平台视同发布失败。非标签触发（如 PR、手动 dispatch）的构建 SHALL 只产出工作流工件（artifact），MUST NOT 创建或修改任何 GitHub Release。

#### Scenario: 推送 v0.1 触发首个公开版
- **WHEN** 向仓库推送标签 `v0.1`
- **THEN** 构建完成后出现同名 GitHub Release，其资产同时包含带版本号的 `AI_Novel_Setup_v0.1.exe` 与 `AI_Novel_mac_0.1.dmg`

#### Scenario: PR 构建不对外发布
- **WHEN** 打包流水线由 PR 或手动 dispatch 触发
- **THEN** 仅生成可下载的 workflow artifact，Releases 页无新增、无改动

### Requirement: 固定命名稳定直链

每个经 `v*` 标签发布的 Release SHALL 额外携带两份固定命名副本：Windows 为 `AI-Novel-Setup-Windows.exe`、macOS 为 `AI-Novel-Setup-macOS.dmg`。`https://github.com/<owner>/ai-novel/releases/latest/download/<固定名>` MUST 始终解析到最新正式版的对应安装包，文件名不随版本号变化。

#### Scenario: latest 直链下载
- **WHEN** 用户访问 `releases/latest/download/AI-Novel-Setup-Windows.exe`
- **THEN** 下载到当前最新正式版的 Windows 安装包，macOS 直链接 `/AI-Novel-Setup-macOS.dmg` 同理

#### Scenario: 发新版后旧直链失效性
- **WHEN** 之后任意新 `v*` 标签完成发布
- **THEN** 同一固定名 URL 无需任何配置改动即改指新版安装包

### Requirement: 落地页下载入口

S端 落地页 SHALL 提供可达的客户端下载入口：Hero 区主操作按钮 MUST 以动词起句且外链指向本仓库 GitHub Releases 最新版页面（owner 为 `modoojunko`）；激活指引第 1 步 MUST 同时写明 Windows 与 macOS 双平台获取方式。代码库内 MUST NOT 出现拼写错误的仓库 owner 或死链式下载入口。

#### Scenario: 访客从落地页进入下载
- **WHEN** 未登录访客打开落地页并点击 Hero 区下载按钮
- **THEN** 新开 `https://github.com/modoojunko/ai-novel/releases/latest` 且页面存在（非 404）

#### Scenario: 激活指引双平台口径
- **WHEN** 访客阅读激活指引「下载安装」步骤
- **THEN** 文案同时覆盖 Windows 安装包与 macOS DMG 的获取说明，未遗留"仅 Windows"表述
