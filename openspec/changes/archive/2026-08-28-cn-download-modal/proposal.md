## Why

GitHub 直链在国内网络下用户基本下载不动（本机直连 github.com 也超时），下载是转化漏斗上最后断掉的一环。同时现行发版同步依赖"自动开 bump PR → 人工合入"才能让落地页指向新版，且版本号烧在前端代码里，改一次地址就得发一版前端。已探明：www.awesomenovel.com 的根路径路由本就指向静态托管（`/api/` 才是云托管），静态托管里的文件天然以 www 自家路径可直接访问（v0.11 已实测 200、均速 1.6MB/s）。据此把分发真身切到静态托管，并把"最新版本号"做成线上配置文件，下载交互改为弹窗确认。

## What Changes

- CI（`client-package.yml`）：release job 新增「转存资产到静态托管」——把已在手的构建产物上传 `/download/v<VER>/`（与 GitHub 资产名 1:1），随后写 `download/latest.json`（`{"version":"x.y"}`），两步各带校验；**删除**「Open landing version bump PR」步骤（机制被 latest.json 取代）。
- 落地页下载交互改版：Hero 未登录态回归单主按钮「免费下载」，点击打开**下载弹窗**；弹窗内 fetch latest.json 实时解析版本，渲染版本 pill + 双平台版本化直链按钮（`www.awesomenovel.com/download/v<VER>/…`）+ macOS 首开提示 + 「查看其他版本 →」次级链；加载/成功/降级三态。
- 版本事实源迁移：`latest.json` 成为线上唯一事实源（改它即改下载地址，零前端发版）；代码常量降级为 fetch 失败时的兜底。页面副行不再展示版本号，版本承诺收敛到弹窗一处。
- 缓存策略：`download/latest.json` 不缓存（改了即刻生效），`download/v*/` 安装包长缓存（版本化路径永不覆盖）。
- 规格：MODIFIED「落地页下载入口」；ADDED「安装包国内分发」。

不在本变更范围：GitHub Release 产出本身（继续保留，作开发者/兜底渠道）、激活指引文案、v0.11 及更早存量资产。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `installer-release`: ADDED「安装包国内分发」（静态托管转存 + latest.json 事实源）；MODIFIED「落地页下载入口」（双按钮直链 → 单按钮 + 下载弹窗；版本常量 → latest.json 事实源）。

## Impact

- `.github/workflows/client-package.yml`（转存步骤、latest.json 写入、删 bump-PR 步骤）。
- `server/frontend/src/components/landing/HeroSection.vue`（单按钮 + 弹窗）、`server/frontend/src/constants/client-release.ts`（fetch 逻辑 + 兜底）。
- 复用既有组件：AppModal / LoadingSkeleton / .pill——无新组件形态。
- 静态托管已具备承载条件（v0.11 资产已实测在位可下载），CI 凭据现成。
- 附带收益：Actions「允许开 PR」控制台开关的待办作废（不再需要 CI 开 PR）。

## Design Impact

- 受影响端：S端（落地页 Hero + 新增下载弹窗浮层）；CI 无 UI 面。
- 对象状态：弹窗三态（加载=LoadingSkeleton、成功=info 语气 pill、降级=warn 语气 pill），全部走既有语气词表（info/warn），无第四形态；无 toast/notice 新增。
- 共享段：不触碰；视觉全部走既有 oklch 令牌与组件类。
- 原型先行：**是**——Open Design 原型已落 `design/modal-prototype.html`（三态可切换），交互规格见 `design/ui-spec.md`；实现后三态截图归档 `screenshots/`。
- 文案规则：按钮动词起句；无内部术语（CDN/latest.json 等不出现在用户界面）；补救出口（查看其他版本 →）。
- 设计工件：ui-design 技能流程产出（规格声明 + 原型，见 design/ 目录）；实现侧自查门禁。
