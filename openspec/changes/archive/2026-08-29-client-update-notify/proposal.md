# Proposal: client-update-notify（C端 版本更新检测与提示）

## Why

C端 安装包经 S端 官网分发，打 tag 即全自动出包、转存国内 CDN、更新 `latest.json`——但这条链只服务「新访客下载」。已安装的 C端 运行时既不知道自己的版本号，也没有任何检测新版本的通道：存量用户会永远停留在旧版，直到碰巧重访官网。发布链路已就绪（v0.12 起零人工），缺的只是 C端 侧的「自知版本 + 感知新版 + 引导更新」这一段闭环。

## What Changes

- **版本自报**：打包期把版本号烘进安装包（复用 release.json 通道，新增 `client_version` 键；tag 构建写真实版本，PR 构建写 `dev`）；C端 本地后端新增 `GET /api/version`。
- **新版本检测**：C端 本地后端新增 `GET /api/update-check`——启动时与会话内每小时复查（长开写作不重启也能感知；真实外呼按 1 小时节流，结果落 `data/`），外呼仅允许 https 且 host 必须命中烘入可信域集合（主下载域 + 云托管直连兜底域，主域失败自动切兜底，拒绝 localhost/环回/私网/保留地址）、版本数值段比较（`0.10.1 < 0.11`）；网络失败静默降级，绝不打断用户。
- **提示条触达**：C端 全局更新提示条（ClientShell 层、所有屏可见），info 语气 notice，「发现新版本 vX.Y」（`notes` 摘要有值时附一句说明）+ 动词主按钮「去下载」唤起系统浏览器直达官网下载页 + 次级动作「查看更新内容」打开该版本更新说明页；可关闭，关闭后对该版本不再弹。
- **版本更新说明页**：发版流水线为每个 `v*` 版本自动生成 `download/v<VER>/notes.html`（版本化目录、只增不改），内容优先级取 tag 附注 → 提交摘要 → 通用兜底文案，页面含版本号、更新内容与双平台安装包下载直链。
- **latest.json 契约扩展**：`notes`（附注首行摘要，CI 自动写入）改为自动产出；预留 `min_version` 字段（强更门槛，**本期只定义字段不实现客户端强更 gate**）。
- **非目标（本期不做）**：应用内下载安装包/自动更新/差分热更；设置面板手动「检查更新」入口；强更阻断；灰度发布（全局单值，出问题重打 tag 修正——已接受）。

### 已采用的默认拍板（审批时可推翻）

| 开放问题 | 本方案默认 |
|---|---|
| 检测时机 | 启动时 + 会话内每小时复查（真实外呼 1 小时节流）；无手动入口 |
| 提示条位置 | ClientShell 全局层，所有屏（含工作台沉浸模式） |
| 检测兜底 | 烘云托管静态托管直连域，主域失败自动切（与登录链路 fallback 同构） |
| notes 来源 | tag 附注消息自动取（推荐 `git tag -a` 打标）；无附注回退提交摘要/通用文案 |
| 灰度 | 不做，全局单值 |

## Capabilities

### New Capabilities

- `client-update`: C端 版本自报、新版本检测（节流/安全校验/版本比较）与更新提示条交互的完整行为契约。

### Modified Capabilities

- `installer-release`: release.json 烘焙内容扩展 `client_version`（+ 检测 URL 烘焙键 `client_update_url`，域名可变不落死代码）；`latest.json` 契约扩展可选 `notes` 与预留 `min_version` 字段。

## Impact

- **CI/打包**（`.github/workflows/client-package.yml`）：Generate release.json 步骤加版本与主/兜底检测 URL 三键（新增仓库 Variables `CLIENT_DOWNLOAD_BASE` / `CLIENT_DOWNLOAD_BASE_FALLBACK`）；Publish 步骤写 latest.json（`version` 必写、`notes` 自动取附注首行）并生成/转存每个版本的 `notes.html` 更新说明页。
- **C端 后端**（`client/backend/`）：`config.py` 收键扩展；新路由（version / update-check）；`data/` 新增节流文件。
- **C端 前端**（`client/frontend/src/`）：ClientShell 挂载更新提示条新组件；api client 增对应调用。
- **S端**：无代码改动（`latest.json` 生产端在 CI；下载弹窗消费逻辑兼容新增字段）。
- **设计资产**：`docs/design-c/prototypes/list.html`、`book.html` 原型先行 + ADJUSTMENTS.md 登记。

## Design Impact

- **受影响端**：C端（含用户可见 UI）；S端 无界面改动。
- **受影响屏/弹层**：全部屏——提示条为 ClientShell 全局层元素；代表原型 `list.html`（书架）与 `book.html`（工作台，需设计期定沉浸模式下的呈现）。
- **对象状态**：应用对象新增「有可用更新」状态（info 语气 notice 呈现 + 可关闭；标准正文 §5 状态语言总表如未覆盖，设计工件期对照补记）。
- **共享段**：不触碰 base.css 令牌与 notice 家族基础类；复用既有 `.notice` info 语气，无新增语气、无 `.b`/`.strip`/第四种胶囊形态。若实现期发现需要新样式，走 ADJUSTMENTS.md 偏差登记而非私改共享段。
- **原型先行**：需要（C端 用户可见改动）。
- **设计工件产出方**：实现侧自查（单元素复用 notice 家族，不涉及布局重构）。
