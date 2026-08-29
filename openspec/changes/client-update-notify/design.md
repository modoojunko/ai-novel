# Design: client-update-notify

## Context

发布链路已全自动（tag → 双平台安装包 → GitHub Release → 国内 CDN 转存 → `latest.json` 更新），且 `latest.json` 已是落地页下载弹窗的版本事实源。本设计补齐 C端 侧：版本自报、检测、提示。三个硬约束决定了形态：

1. `latest.json` 无 CORS 头（实测确认），C端 前端 origin 是 `http://127.0.0.1:<随机端口>` → 前端直连事实源不可行。
2. 出站请求必须过安全校验（仅 https、公网 host、拒私网/环回）——校验逻辑天然属于后端。
3. C端 用户可见改动须原型先行 + design 门禁（见 proposal Design Impact）。

## Goals / Non-Goals

**Goals**

- 检测分层干净：后端承担全部逻辑（版本、节流、校验、比较、关闭记忆），前端是哑渲染组件。
- 复用已验证轨道：release.json 烘焙通道、httpx 出站模式、notice 组件家族。
- 换下载域名零代码（走仓库 Variable）。

**Non-Goals**（proposal 已列，此处补设计层面边界）

- 不做应用内下载/安装/重启编排——「去下载」止步于唤起系统浏览器。
- 不做检测预热线程/推送——纯拉取 + 节流。
- 不给静态托管加 CORS 配置——检测不经前端直连。

## Decisions

### D1: 检测放本地 Python 后端，前端只渲染

前端直连 `latest.json` 需要给 CDN 加 `Access-Control-Allow-Origin`，且 URL 校验无法在前端强制；放后端则复用 `auth_local/service.py` 已验证的 httpx 出站模式，CORS 不存在，校验集中一处。

- 端点：`GET /api/update-check`，同步外呼（超时 ~6s）。前端启动后异步拉取，最坏晚几秒出提示条，不阻塞 UI 渲染。
- 成本红线：外呼目标 MUST 锁定静态托管 latest.json（www 或直连域），MUST NOT 改走 S端 `/api/*` 动态接口——云托管容器按需拉起即计费且有冷启动 503，静态托管 COS 直出无容器成本（实测上游 `x-cloudbase-upstream-type: Tencent-COS`）。小时级轮询的真实开销是每机每月 <1MB 流量，与容器计费无关。
- 会话内复查：前端定时器轮询本地端点（间隔约 15 分钟），真实外呼频率由后端 1 小时节流统一裁决——轮询与外呼解耦，本地调用零成本，节流边界抖动无害。长开会话由此在不重启的情况下呈现新提示条。
- 返回载荷：`{current, latest, has_update, notes?}`。`has_update` 在后端算好（含"已对该版本关闭"的记忆），前端不重复实现比较逻辑。

### D2: 版本注入走 release.json 通道

候选对比：

| 方案 | 否决理由 |
|---|---|
| PyInstaller 版本资源 | Windows/macOS 平台分叉，mac 无统一资源机制 |
| 安装器写文件（installer.iss [Code]） | 平台分叉（dmg 无安装器），且与 dev 模式路径不一致 |
| 运行时从可执行文件名反推 | 便携模式改名即碎；.app bundle 内文件名不可控 |
| **release.json 加键** | 通道现成（datas + 冒烟断言已存在），dev 缺文件即回退，与 S端 地址注入同构 |

CI "Generate release.json" 步骤加 `client_version`（tag → 去 v 版本号；PR → `dev`）、`client_update_url`（Variable `CLIENT_DOWNLOAD_BASE` + `/latest.json`，默认 `https://www.awesomenovel.com/download/latest.json`）与 `client_update_url_fallback`（Variable `CLIENT_DOWNLOAD_BASE_FALLBACK` + `/latest.json`，默认云托管静态托管直连域 `https://ai-novel-test-d1ghsr86ra814c12c-1468883265.tcloudbaseapp.com/download/latest.json`——已实测 HTTPS 200 取到生产 latest.json；直连域与营销域名解耦，与登录链 `server_api_fallback` 同构）。`config.py` 的 `RELEASE_OVERRIDE_KEYS`/`load_release_overrides` 收这三个键。冒烟断言扩展覆盖新键。

### D3: 节流与关闭记忆合一个文件，后端持有

`data/update-check.json`：`{last_check_at, dismissed_version, cached: {latest, notes}}`。

- 1 小时内命中节流 → 直接回 `cached` 计算结果，零外呼。
- 关闭提示条 → 前端调本地端点记 `dismissed_version = latest`；`has_update = latest > current && latest != dismissed_version`。
- 文件损坏/缺失 → 按 `{}` 处理，行为等同首次启动。
- 关闭记忆放后端而非 localStorage：与节流同文件单一事实源，逻辑全在后端可测（前端哑组件），且避免用户清浏览器存储导致重复弹。

### D4: 出站校验双层——可信域白名单 + DNS 解析 IP 复核，主域失败切兜底

1. `urlparse` 校验 scheme == `https`；
2. host 精确匹配烘入的可信域集合（主下载域 + 兜底直连域，共两个，杜绝任意跳转）；
3. `getaddrinfo` 解析结果逐个过 `ipaddress` 拒绝环回/私网/保留地址（防域名指向内网）。

取数顺序：先主地址，失败（超时/连接错误/HTTP 异常）再兜底地址，全部失败才静默降级——复刻 `auth_local` `call_server_api` 的双基址切换模式，不新发明重试策略。安全校验对两个地址逐一适用。

Trade-off：解析与实际请求之间存在 TOCTOU 窗口（DNS rebinding 类）。威胁模型是防配置错误与误用，不是对抗 APT，可接受；httpx 请求仍走 https，代价有限。

### D5: 版本比较为纯函数数值段比较

`tuple(int(x) for x in ver.split('.'))` 补齐长度后逐段比较；任何段非数字 → 视为载荷非法走失败分支。线上版本不高于本机（含人工回滚）一律不提示。

### D6: 提示条形态与「去下载」「查看更新内容」跳转

- 位置：`ClientShell` 全局层（`children` 之上），所有屏可见；复用既有 `.notice` info 语气，无新基础类。工作台沉浸模式下的具体呈现（间距/收窄）在原型期于 `book.html` 定稿。
- 动作：主按钮「去下载」直达官网下载页；次级动作「查看更新内容」打开该版本更新说明页（见 D9）。两个外链均首选 `window.open(url, '_blank')`——pywebview 默认将外部链接丢给系统浏览器。实现期两平台实测；若某平台在 webview 内嵌打开，退路是本地后端加 `webbrowser.open` 端点。此为验证点而非架构分叉（两种写法对 spec 行为等价）。
- 文案：`发现新版本 v0.13`（`notes` 摘要有值时附一句）+ 主按钮「去下载」+ 次级「查看更新内容」+ 关闭钮。符合 §13（动词、无内部术语、出口可点击）。

### D7: latest.json 生产端——notes 从 tag 附注自动取

CI 写 latest.json：`version` 必写；`notes` 取 tag 附注首行自动写入（无附注省略该键）。发版 SOP 保持零人工，推荐打标方式改为 `git tag -a vX.Y -m "更新内容"`。`min_version` 仍为人工预留字段，不在 CI 自动产出。

### D9: 版本更新说明页——CI 生成静态 notes.html，放国内 CDN

用户要在提示里看到"新版本改了什么"。候选对比：

| 方案 | 否决理由 |
|---|---|
| 链到 GitHub Release 页 | 国内不可达，不能当主通道 |
| 应用内弹窗渲染 notes | 新增弹层原型/e2e/取文逻辑，C端 UI 面积膨胀 |
| latest.json 塞全文 | 载荷无界增长，长文在提示条里也放不下 |
| **CI 生成 notes.html 到版本化目录** | 与安装包同目录只增不改；国内 CDN 直达；自带下载直链看完就地能下；C端 零新增 UI（一个次级链接动作） |

- 内容优先级：tag 附注全文 → `git log <上一版 tag>..<本版 tag> --oneline` 提交摘要 → 通用兜底文案（"问题修复与体验优化"）。任何一级缺失不阻断发版。
- 页面为 CI 内联生成的极简独立 HTML（版本号 + 更新内容 + 双平台版本化直链 + 回首页链接），不依赖 S端 构建；样式保持中性克制，不引入设计系统联动。
- C端 侧 URL 构造：烘入下载域 + `v<VER>/notes.html`，与检测 URL 同源，换域名逻辑一致；latest.json 不需要为此加字段。

### D8: S端 下载弹窗零改动兼容

`fetchLatestRelease` 只读 `version` 字段且带格式校验，新增可选键天然忽略；以现有下载弹窗 e2e 回归确认，不动 S端 代码。

## Risks / Trade-offs

- [pywebview 外链行为平台差异] → D6 验证点 + 后端 `webbrowser.open` 退路，两写法行为等价。
- [工作台沉浸模式与全局提示条冲突] → 原型先行在 `book.html` 出方案后实现，ADJUSTMENTS.md 登记。
- [latest.json 被误写（坏格式/超高版本号）] → 消费端格式校验 + 严格大于才提示 + 失败静默；最坏情况人工改回。
- [节流文件与用户数据同目录被误删] → 缺失按首启处理，多弹一次，无害。
- [TOCTOU DNS 窗口] → D4 已述，威胁模型外。
- [**存量旧版无追溯力**：已装 v0.11 及更早的用户本机制不生效] → 一次性缺口，只能靠官网/社群引导重下；从首个含本机制的版本起闭环成立。发布时知晓即可，无技术补救（旧包无检测代码）。

## Migration Plan

纯增量，无数据迁移。 rollout：合入后下一个 `v*` tag 起生效（该版本自身还检测不到更新——它就是基准版；再下一版起存量用户开始被触达）。回滚：把 `latest.json` 版本改回即可让提示消失（严格大于才提示），无需发版。

## Open Questions

- pywebview `window.open` 在 Windows/macOS 的实测行为（实现期验证，D6 有退路）。
- 提示条关闭钮视觉形态与工作台收窄细节（原型期定，不影响架构）。
