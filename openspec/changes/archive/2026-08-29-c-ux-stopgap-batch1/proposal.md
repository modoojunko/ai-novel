# c-ux-stopgap-batch1 · C端 UX 止血批（批次一）

## Why

docs/ux 审计（`audit.html` P0 功能断裂）与 `cross-end.html` 裁判定案的 C端 首批止血：4 处断裂用户真实可踩（阅读弹窗字体静默退化、设置页链接整页跳出应用、目标字数双口径、未知路由白屏），外加骨架屏本地关键帧未归一（cross-end P0 #4 的 C端 半边，S端 已于 #218 完成）。全部小改动、零视觉漂移预期，先于批次二（启动主页改版）落地。

## What Changes

- `ContrastPreviewModal` 字体令牌修正：`var(--font-serif)`（未定义，静默回退无衬线）→ `var(--font-display)`
- `ModelSettingForm` no_key 态「去配置」链接 `href="/config"` → `href="#/config"`（HashRouter 下原写法整页跳出应用）
- 目标字数默认统一为 **2500**：`useChapterData` 的 `DEFAULT_TARGET` 2000→2500、`Rail` 回退值同步、对应单测更新（后端 `WORD_TARGET_DEFAULT = 2500` 是唯一事实源）
- `App.tsx` 增加兜底路由 `path="*"` → `<Navigate to="/novels" replace>`，未知地址不再白屏
- 书架 / 模型配置页加载骨架收编 `.sk` 原子 + `sk-pulse` 关键帧，删本地 `skeleton-pulse`（`list.css`）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `chapter-data`: `useChapterData` 的 `targetWords` 缺省回落值定为 2500，对齐后端生成管线默认，UI 进度与生成口径一致
- `novel-workspace`: 路由收敛补充未知路由兜底——重定向 `/novels`，不再白屏

## Impact

- 代码：`client/frontend` 6 处文件（两个 tsx 修复、hook + Rail + 单测、`App.tsx`、`list.css` 与两个骨架调用点）
- 不改两端共享段声明（仅消费已在 `@cross` 段的 `.sk`/`sk-pulse`）；`design:cross` 复跑确认零差异
- 视觉：预期零像素漂移（骨架几何保留本地作用域取值，书架骨架本就无 parity 态）；书工作台 parity 基线需 `design:check` 复核（Rail 回退文案 2000→2500 理论可见于无目标章）
- 无后端改动

## Design Impact

- **受影响端**：仅 C端
- **屏/弹层清单**：润色/扩写对比弹窗、设定面板·模型表单（no_key 态）、工作台右栏进度区、书架/模型配置页加载骨架、全局路由兜底
- **对象状态**：loading 骨架态类契约归一（视觉不变）；不新增状态与语气词
- **是否触共享段**：否（只消费 `.sk`/`sk-pulse`，不改声明；`design:cross` 仍复跑）
- **是否需要原型先行**：预期零像素变化，以 `design:check` 全绿兜底；若书工作台基线漂移，按红线先改原型并登记 `ADJUSTMENTS.md`
- **设计工件由谁产出**：实现侧自查（裁定已在 `audit.html` / `cross-end.html` 定案）
