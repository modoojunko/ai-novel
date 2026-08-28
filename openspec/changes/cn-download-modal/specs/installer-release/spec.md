# installer-release 变更规格

## ADDED Requirements

### Requirement: 安装包国内分发

系统 SHALL 在 `v*` 标签发版时把双平台安装包转存到静态托管（CloudBase Hosting）的 `/download/v<VER>/` 目录，文件名与 GitHub Release 资产 1:1（`AI_Novel_Setup_v<VER>.exe` / `AI_Novel_mac_v<VER>.dmg`）。转存完成后系统 SHALL 更新 `download/latest.json`（内容为最新版本号），该文件 MUST 是落地页解析最新版本的唯一线上事实源；更新它 MUST NOT 依赖任何前端重新发版。转存或 latest.json 更新失败 MUST 使发版流水线失败，不得静默。已发布的版本目录 MUST 只增不改（版本化路径永不覆盖，使长缓存安全）。

#### Scenario: 发版后国内直链可下载
- **WHEN** 任意 `v*` 标签发版流水线成功结束
- **THEN** `https://www.awesomenovel.com/download/v<VER>/AI_Novel_Setup_v<VER>.exe` 返回 200，且字节数与 GitHub Release 同名资产一致（dmg 同理）

#### Scenario: latest.json 即时生效
- **WHEN** `download/latest.json` 的版本号被更新（CI 自动或人工）
- **THEN** 落地页下载弹窗此后解析到的版本随之变化，无需前端重新发版

#### Scenario: 转存失败不静默
- **WHEN** 转存上传或 latest.json 写入的校验未通过
- **THEN** 发版流水线以失败结束并给出明确错误，GitHub Release 可能已建但流水线状态不得为绿

## MODIFIED Requirements

### Requirement: 落地页下载入口

S端 落地页 SHALL 提供可达的客户端下载入口：未登录态 Hero 区 MUST 呈现单枚主按钮「免费下载」，点击后打开**下载弹窗**（复用既有浮层组件）。弹窗打开时 SHALL 立即同源获取 `download/latest.json` 解析最新版本，并渲染：版本 pill、两枚平台下载按钮（`下载 Windows 版` primary / `下载 macOS 版` secondary，均动词起句，href 分别指向静态托管的 `download/v<VER>/AI_Novel_Setup_v<VER>.exe` 与 `download/v<VER>/AI_Novel_mac_v<VER>.dmg`，双平台文件名统一带小写 `v` 前缀）、macOS 首开提示与「查看其他版本 →」次级链接（指向 GitHub Releases 页）。弹窗 MUST 具备三态：加载中（骨架占位）、成功（info 语气版本 pill）、降级（fetch 失败时代码兜底版本照常可下，warn 语气 pill 明示）。弹窗内用户所见版本 MUST 与点击所下文件名的版本一致。页面其余区域 MUST NOT 承诺具体版本号（版本展示收敛到弹窗）。`download/latest.json` 的版本号 MUST 为唯一线上事实源；前端代码内的版本常量 SHALL 仅为请求失败时的兜底。已登录态 SHALL 保持「进入控制台」主操作不变，不渲染下载入口。激活指引第 1 步 MUST 同时写明双平台获取方式。代码库内 MUST NOT 出现拼写错误的仓库 owner 或死链式下载入口。

#### Scenario: 未登录访客点击 Windows 下载按钮
- **WHEN** 未登录访客打开下载弹窗并点击「下载 Windows 版」
- **THEN** 浏览器开始下载 `www.awesomenovel.com/download/v<N>/AI_Novel_Setup_v<N>.exe`，其中 `<N>` 与弹窗内展示的版本 pill 一致

#### Scenario: 未登录访客点击 macOS 下载按钮
- **WHEN** 未登录访客打开下载弹窗并点击「下载 macOS 版」
- **THEN** 浏览器开始下载 `www.awesomenovel.com/download/v<N>/AI_Novel_mac_v<N>.dmg`，版本同弹窗所见

#### Scenario: 弹窗打开即取最新版
- **WHEN** 访客在落地页停留期间线上发布了新版本，其后才点击「免费下载」
- **THEN** 弹窗渲染的是 latest.json 里的最新版本，点击下载得到最新版安装包

#### Scenario: 弹窗获取失败降级
- **WHEN** 弹窗内 latest.json 请求失败或超时
- **THEN** 弹窗以代码兜底版本渲染并可正常下载，版本 pill 使用 warn 语气明示"未能获取最新版"，不阻塞下载

#### Scenario: 版本号单一事实源
- **WHEN** 需要更新落地页所指客户端版本
- **THEN** 仅更新 `download/latest.json` 一处即全站生效，无需前端发版；代码常量仅作请求失败兜底

#### Scenario: 访客从落地页进入下载
- **WHEN** 访客点击弹窗内「查看其他版本 →」次级链接
- **THEN** 新开 `https://github.com/modoojunko/ai-novel/releases` 页面且存在（非 404），可浏览全部版本与历史版安装包

#### Scenario: 副行双平台口径
- **WHEN** 访客阅读 Hero 下载区副行文案
- **THEN** 文案同时提及 Windows 与 macOS，且不出现具体版本号字样（版本展示收敛到弹窗）

#### Scenario: 已登录访客的 Hero 主操作
- **WHEN** 已登录用户打开落地页
- **THEN** Hero 主操作为「进入控制台」，不出现下载入口

#### Scenario: 激活指引双平台口径
- **WHEN** 访客阅读激活指引「下载安装」步骤
- **THEN** 文案同时覆盖 Windows 安装包与 macOS DMG 的获取说明，未遗留"仅 Windows"表述
