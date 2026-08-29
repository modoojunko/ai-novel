# Design · c-bookshelf-states

## Context

书架三态设计稿已在 `docs/ux/home.html`（v2 裁定后归属 `/novels`）。审计 P0 #3（免费零引导）/ #4（满额隐藏入口）的正解都在此批。免费额度事实源：`auth_local/deps.require_project_limit`——免费/过期 `project_limit=1`，会员不限；`NovelListPage.freeLimitReached = !isMember && novels.length >= 1` 与后端一致。品牌 agent 正在评审三态（后台），意见到位后吸收进实现。

## Goals / Non-Goals

**Goals**：三态落地；P0 #3/#4 关账；文案数字与后端口径一致。
**Non-Goals**：不改变额度本身的数值与会员体系；不做新手教程页（外链维持）；S端 不动。

## Decisions

1. **免费额度文案一律「1 部」**：后端 `project_limit=1` 是唯一事实源；设计稿「3 部」「3/3」是立项时的假设，全部纠正（首页注脚已先行修正）。若产品未来想放宽到 3，改后端口径后 UI 文案同步即可。
2. **满额「锁定可见」**：新建/导入按钮保留可见可点（主按钮加锁图标），点击走既有升级引导链路（UpgradeModal / portal 直连，`upgradeBtn` 既有函数复用）；网格尾加「升级锁卡」（.lock-tile）。绝不隐藏入口（审计 #4 正解）。
3. **`.resume` 数据口径**：`novels` 列表按 `updated_at` 降序取第一个；仅当书架非空且 ≥1 本书时显示（回访态）；首启态（0 本）与满额态（免费 1 本已满）互斥。点击整条跳 `/novel/:id`。
4. **首启三步引导**：替换现有 `.empty`「还没有作品」单块——但保留 `.empty` 虚线卡形态（设计稿即 .empty 家族内长出）；CTA「新建作品」触发既有 CreateProjectModal，「导入已有文稿」触发既有 ImportNovelModal。
5. **样式归属**：`.resume/.first-run/.lock-tile` 落 `list.css` 本地段（书架屏私有，非共享段），逐字取自设计稿；ADJUSTMENTS 登记。

## Risks / Trade-offs

- **parity 基线**：books 场景若截到继续创作条会漂移——实现后跑 `design:check`，若漂移按红线先改 `list.html`（加 resume 条态）并登记再对齐实现。empty 场景被首启三步引导替代的话同样处理（empty 基线态 = 空书架，三态设计正是空书架新样子，**必须先改 list.html 的 empty 态原型**——此为硬前置）。
- 品牌 agent 意见未回：实现按设计稿先行，意见到达后在同 PR 内吸收（CSS/文案级）。

## Open Questions

无（额度数值若产品想调，另批走后端口径）。
