# cn-download-modal · 设计

## Context

v0.11 全链路演练后确认两个事实：① GitHub 直链在国内不可用作主分发（下载体验卡死）；② www.awesomenovel.com 的路由现状是 `/`→静态托管、`/api/`→云托管（#213 时期配置），静态托管里的文件天然以 www 自家路径直达且走 CDN（v0.11 实测 200、1.6MB/s）。据此分发真身切静态托管；版本号从"烧进前端代码 + bump PR 同步"迁移到"线上 latest.json 配置面"，下载交互改为弹窗确认。原型与交互规格见 `design/`（ui-design 技能流程产出，Open Design v2 语言）。

## Goals / Non-Goals

**Goals:**

- 国内用户从落地页点下载到拿到安装包，全程腾讯云链路、CDN 速度。
- 发版零人工：打 tag → GitHub Release + 静态托管转存 + latest.json 更新全自动；官网即刻指新版。
- "随时改下载地址"：改 latest.json 一个文件即生效，无需前端发版。
- 所见即所下：弹窗内展示的版本与下载文件名版本由同一次渲染决定。

**Non-Goals:**

- GitHub Release 产出与「其他版本」页（保留为开发者/兜底渠道，规格继续约束其双平台资产）。
- S端 后端任何改动（曾设计的 302 路由作废——网关根路径已指向静态托管，无需转发层）。
- C端 应用内自动更新机制（用户拿到旧版时的升级引导，后续独立课题）。
- 下载埋点/统计。

## Decisions

### D1 · 分发真身 = 静态托管，www 路径直达

`/download/v<VER>/<文件名>` 与 GitHub 资产名 1:1 镜像、按版本建目录、只增不改（长缓存安全 + 对齐 GitHub 不可变心智）。曾评估的 S端 302 路由与独立子域名方案均作废：前者多余（根路由已在静态托管），后者要配 DNS/证书。

### D2 · latest.json = 线上版本事实源，取代 bump PR 机制

`download/latest.json` 内容 `{"version":"x.y"}`；前端打开弹窗时同源 fetch，用既有文件名模板拼直链；代码常量（`client-release.ts`）降级为请求失败兜底。对比被取代的 bump PR：零人工、零延迟、改地址零发版；代价是前端多一次同源请求（弹窗打开时，几十毫秒）。**缓存策略为正确性前提**：`download/latest.json` 必须不缓存（或极短 TTL），`download/v*/` 长缓存——版本化路径永不覆盖使后者安全。

### D3 · 弹窗交互：所见即所下

打开即弹（无感知等待）→ 内嵌 fetch → 三态（骨架/info pill/warn pill 降级）。副行去掉版本号：版本承诺收敛到弹窗一处，杜绝"页面写 v0.11、实际下到 v0.12"的观感分裂。降级态可下不阻塞（沿用"忘更新不坏链"的降级哲学）。复用 AppModal（`.modal/.mcard` 既有动效与无障碍基线）、LoadingSkeleton、`.pill` 语气——零新组件。

### D4 · CI：删 bump-PR 步骤，加转存 + latest.json

release job 内已持有下载好的构建产物：`tcb login --cloudbase-api-key` → `tcb hosting deploy`（或等价 storage 上传命令）传 `/download/v<VER>/` → 写 `latest.json` 并上传 → HEAD 校验两文件存在且字节数与 GitHub 资产一致，任一失败 exit 1。**附带收益：Actions「允许创建 PR」控制台开关的待办就此作废**（不再需要 CI 开 PR）。上传通道凭据复用既有 secrets（S端部署同款）。

### D5 · 落地即时可用

apply 阶段用 MCP 手写 `latest.json`（`{"version":"0.11"}`）——v0.11 资产已在托管，**合并当天落地页即可切到国内直链**，无需等下一个 tag。后续 v0.12 起全自动。

## Risks / Trade-offs

- [latest.json 被中间层缓存导致"改了不生效"] → 缓存规则显式 no-cache（D2）；校验步骤含 GET latest.json 内容断言。
- [CI 内上传 38MB 大文件耗时/超限] → 静态托管单文件上限远大于安装包；上传走内网通道的 runner 到腾讯云，预计秒级；失败即流水线红，无静默。
- [弹窗 fetch 增加一次请求] → 同源静态文件，毫秒级；失败有兜底，不影响主流程。
- [代码兜底版本与线上漂移] → 兜底仅应急；漂移上限=一个发版周期，且 warn pill 会如实标注。
- [工作区用户未提交文件] → 延续纪律：PR 只圈本 change 文件。

## Migration Plan

1. 单 PR：workflow 改造 + 前端弹窗/常量 + 本 change 工件；门禁全绿合入（前端自动部署）。
2. 合入后 MCP 手写 `latest.json`=v0.11 → 线上验收：弹窗三态 + 双平台下载实测（字节数与 GitHub 资产比对）。
3. 下一版 v0.12 起全自动（转存 + latest.json），发版 SOP 更新为"打 tag 即完事"。
4. 回滚：revert 单 commit 前端回 GitHub 直链（常量兜底仍在）；托管侧文件留存无害。

## Open Questions

（无——分发选型、交互形态均经用户拍板；缓存规则若 API 通路不可用则控制台手配，不影响方案。）
