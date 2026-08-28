## Context

用户拍板：默认主题保持 teal 现状，换色产品化为用户可选偏好，状态存 S端，接口为 C端 复用预留。上一分支 `feat/s-brand-ink-restyle`（默认翻墨）作废不推；其品牌资产已带入本分支。accent 令牌位于两端 base.css `@cross` L1 逐字同步段，`design:cross` 机器强制；C端 另受 parity 门禁（<0.2%）约束。S端 后端为 FastAPI + DDD 分层 + alembic，用户表 `users`（username 主键），已有 `/api/user/me`。

## Goals / Non-Goals

**Goals:**
- 主题集合契约（key + oklch 定值）双端机器强制一致；默认态与现状逐像素一致
- 用户主题偏好服务端持久化 + 鉴权 API，契约对 C端 冻结
- S端 控制台主题选择器（即时生效 + 持久化 + 失败可重试）
- 全门禁绿（cross / 双端 lint / tsc / S端 e2e / C端 parity / pytest）

**Non-Goals:**
- C端 主题选择 UI 与同步逻辑（后续独立 change，本 change 仅 CSS 预埋 + 契约冻结）
- 落地页/认证页跟随主题（固定默认）
- 暗色模式（本 change 只做 accent 色相维度）
- 主题集合扩容（6 个起步；扩容 = 数据登记 + 双端同批，流程在 spec 已定）

## Decisions

- **D1 覆盖层机制：`:root[data-theme]` 属性选择器**，写在 @cross 段内紧随令牌定义。备选「JS 变量注入」被否——绕过 CSS 层破坏 L1 逐字同契约；备选「多套 class」被否——语义化差且每主题一套类名爆炸。属性选择器默认零命中，默认态零变化，parity 天然绿。
- **D2 色板定值（6 主题）**：teal 默认（现状值不动）/ ink 玄墨 oklch(37% 0.01 250)（三轮评审定稿）/ bamboo 竹青 oklch(60% 0.076 152) / rouge 胭脂 oklch(58% 0.11 8) / wisteria 紫藤 oklch(58% 0.084 296) / celadon 青瓷 oklch(65% 0.066 184)——均取自三轮 HTML 评审页实际展示过的色值（hex 反算 oklch），strong 档 = L−6 同色相同 chroma。teal 之外 5 个即覆盖评审中被认可度较高的方向，不再新造色。
- **D3 存储：`users.theme` 单列 + 白名单枚举**。备选「独立 preferences 表」被否——当前唯一偏好维度，单列 + 空串默认最省；未来多维度偏好再抽表。值域 = 主题 key 白名单，空串 = 未设置（回落默认）。alembic 迁移沿用 baseline 幂等 DDL 风格。
- **D4 API 形状**：读挂在既有 `GET /api/user/me`（加 `theme` 字段，增量无破坏）；写新开 `PUT /api/user/preferences`。不把写并入 me（me 是只读聚合）；不复用 security/password 端点（语义无关）。校验失败 422 带字段错误信息。C端 token 与 S端 同源，端点天然可复用——契约（路径 + key 白名单）写入 spec 冻结。
- **D5 应用时序**：S端 session store 已在启动时拉 me（含 check-auth 门闩）——theme 应用挂同一时序：me 返回后 `document.documentElement.dataset.theme = theme || ''`。控制台入口前完成，无闪烁；landing/auth 路由不应用（守卫在应用函数内判路由或仅 DashboardLayout 挂载时应用，取后者——作用域天然限定控制台）。
- **D6 选择器 UI**：AccountPage 新增「界面主题」卡片（panel 家族），6 个 swatch 按钮（圆形色块 + 名称），选中态 `--accent-soft` 环 + 对勾 icon（icons.tsx 既有 check 键）。点击：立即 setAttribute → PUT；PUT 失败 → notice err 语气提示 + 「重试」出口（术语表：动词、无内部术语），视觉不回滚（用户所见即当前态，重试成功则落库；刷新后以服务端为准）。
- **D7 品牌资产色维持玄墨**：favicon/安装包图标 = 死资产，不随主题变（每主题出图标不可行）；玄墨中性，与 teal 默认界面无冲突。若用户否决 → 回退 teal 版图标（make_icns.sh 一键重生成，成本 5 分钟）。

## Risks / Trade-offs

- [C端 parity 因 @cross 段新增覆盖层而基线波动] → 覆盖层默认不命中任何元素，渲染零变化；parity 全绿即实证；若 lint 的「裸 hex/任意值」统计误报需甄别（色值全 oklch 字面量，与令牌段同风格）
- [me 接口响应时序早于 CSS 加载导致闪默认] → data-theme 属性设置与样式解析无依赖，属性在 HTML 就绪前设于 documentElement，无 FOUC 风险；e2e 加断言
- [线上 PG 迁移] → alembic 幂等 DDL（add column if not exists 风格沿用 baseline）；存量行空串默认由 server_default 兜底
- [主题 key 与未来 C端 集成分叉] → 契约进 spec（theme-preferences capability）+ 色相登记簿单一事实源；C端 接入 change 只消费不重定义

## Migration Plan

后端迁移 = alembic up（单列，幂等）；前端无迁移；部署走既有 push main 自动发布。回滚 = revert 提交 + alembic down（列可安全丢弃）。无 API 破坏。

## Open Questions

（无——色板、机制、API、UI 均已拍板或由评审定稿推导；D7 图标色为显式供批项，不阻塞其余任务。）
