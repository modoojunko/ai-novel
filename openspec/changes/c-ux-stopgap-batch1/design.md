# Design · c-ux-stopgap-batch1

## Context

C端（React 19 + HashRouter）在 docs/ux 审计中被定案的 P0 功能断裂 4 处 + cross-end P0 #4 骨架屏 C端 半边。共享段基建（`@cross` 标记、`.sk`/`sk-pulse`、`scripts/design-cross.mjs`）已随 #218 落地，本批只消费、不改共享段声明。后端 `chapter_writer.py: WORD_TARGET_DEFAULT = 2500`、`router.py: or 2500` 是目标字数的唯一事实源。

## Goals / Non-Goals

**Goals**：4 处断裂修复 + 骨架屏类契约归一；全程零像素漂移预期。
**Non-Goals**：免费引导卡与额度墙（归批次二 home 改版正解）；`window.confirm` 收编、胶囊/notice 语义收编（归批次三）；任何共享段取值调整。

## Decisions

1. **字体令牌 `--font-serif` → `--font-display`**：`--font-serif` 从未定义，`font-family` 静默回退继承的无衬线；`--font-display`（base.css:28，Noto Serif SC 栈）是规范定的阅读/展示衬线。备选 `.serif` 工具类——该弹窗 pane 用内联样式对象，改令牌值最小且等价。
2. **`href="/config"` → `href="#/config"`**：HashRouter 下裸路径触发浏览器整页导航，落回 `/` 营销页丢失应用状态；hash 链接是全站既有惯例。备选改成编程式导航——为一个静态链接引入 hooks 不值。
3. **目标字数统一 2500**：后端 `or 2500` 落在生成链路上，UI 必须向事实源看齐。改 `useChapterData.DEFAULT_TARGET` 与 `Rail` 回退两处 + 单测断言。备选"改后端就 2000"——动生成语义，影响存量书，否决。
4. **兜底路由 `*` → `Navigate to="/novels" replace`**：桌面 App 的未知地址只会来自失效深链/手误，落书架最符合"home 即书架"方向（与批次二裁定一致）；独立 404 页是批次二后仍有价值再加的增强，本批不做。
5. **骨架收编 `.sk` 原子**：markup `bar` → `sk bar`，`.card-skeleton .bar` 只留几何（height 12 / radius 6 / margin-bottom 10 / w40/70/90），bg 与动画交给 `.sk`；删 `@keyframes skeleton-pulse`。像素等价：bg 同为 `var(--fg-soft)`，脉冲区间同为 0.45↔1（相位差对无 parity 态的加载骨架不可感知）。备选"只换关键帧名不动 markup"——留下第二份 bg/脉冲来源，违背「认 .sk 原子」裁定，否决。

## Risks / Trade-offs

- **书工作台 parity 基线**：Rail 回退 2000→2500 若出现在无目标章的基线态会漂移——`design:check` 复核；漂移则按红线先改原型 `book.html` 并登记 `ADJUSTMENTS.md` 再同步实现。
- **`sk` + `bar` 双类过渡**：`bar` 保留为几何作用域类，命名与 `.sk` 语义并存；批次三语义收编时若出 `.sk-line` 类组合再统一，本批不为收编而收编。
- **e2e「去配置」链接**（`workbench-features.spec.ts:441-447`）断言的是提示词 tab 的就地链接（PromptPane），非本批改的 `ModelSettingForm`，互不影响；相关 e2e 随批次回归确认。

## Open Questions

无（webfont 决策等悬而未决项不在本批范围）。
