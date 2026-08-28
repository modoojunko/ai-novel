## Why

docs/ux 全端一致性审计（cross-end.html，2026-08-27）裁定两端存在 8 处语义漂移，其中 S端侧 5 处至今未收敛：徽标仍是单字母类 `.b`（实测已扩散到 8 文件 12 处，比审计时的 6 文件又增长了 2 个文件）、提示条仍叫 `.strip`（6 文件，与全站 `.notice` 同物异名）、accent 反白仍用 `var(--surface)` 冒充（4 处）、骨架屏脉冲谷值 0.55 未归一到裁决值 0.45、`.panel`/空态动作槽规则未入共享段。同时防再漂移机制为零：共享段无 `@cross-begin/@cross-end` 标记、无 `design:cross` 校验脚本，「两端逐字相同」只是人工快照。handoff.md 已把 P0 机械批 + P1 语义批列为最高优先待办，且 `.b` 的扩散速度说明每拖一个版本漂移面都在变大。

## What Changes

- **徽标收编**：S端 `.b`/`.b.ok`/`.b.err`/`.b.warn`/`.b.muted` 全部改为 `.pill` 三角色（tag/status/count）× 五语气（默认/ok/warn/err/accent），删除 `.b` 基类；8 文件 12 处调用点机械替换（设备卡、授权卡、账户页、授权页、布局、登录/注册/激活页、落地页路线图）。
- **提示条更名**：S端 `.strip` → `.notice`（显式四语气 info/ok/warn/err），dashboard.css 定义迁入统一词汇，6 文件调用点机械替换；语气词表全站唯一，不新增 success/danger。
- **新令牌 `--on-accent`**：两端 `:root` 各加一行；S端替换 4 处反白冒充（`server/frontend/src/design/base.css:50,56,70,106` —— `.btn-primary`/`.btn-danger`/`.logo-mark`/`.toast`）。
- **骨架屏取值归一**：S端 `sk-pulse` 谷值 0.55 → 0.45（仲裁规则：以受 parity 门禁约束的 C端取值定音）。
- **共享段收拢 + 防漂移基线（M1）**：`.pill` 家族、`.notice` 四语气、`.sk(+sk-pulse)`、`.panel(+hoverable/hl/compact)`、空态动作槽两条规则、`--on-accent`、`.toast.warn` 全部落入两端 base.css 的 `@cross-begin/@cross-end` 标记段；新建仓库根 `scripts/design-cross.mjs`，两端 package.json 各加 `design:cross`，建立共享段零差异基线。
- **词汇禁令同批**：两端 `design-vocab.mjs` 同批新增 `.b`/`.strip` 退役禁令（禁止回流），与 cross-end.html §3.1/3.2 裁决对齐。
- **范围外（明确不做）**：C端侧同源账（13 种自制胶囊归档、`toast.warn` 调用、`skeleton-pulse` 删除、model-config 局部 `.panel` 删除、表单错误态启用）另行立项；S端破坏性操作确认组件（现网无删除流，handoff 悬而未决 #5 暂不触发）；P2 机制批（M2 图标断言、M3 禁令共享模块）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `design-system`：
  1. 「Cross-end shared-class synchronization」从「标记落地后 SHALL 留在标记段」的条件式改为无条件 SHALL——本 change 交付 `@cross` 标记与 `design-cross.mjs` 校验（M1），共享段清单扩入 pill/notice/sk/panel/on-accent/empty-slot 家族；
  2. 「Shared status language and tone words」补 S端控制台验收场景：徽标走 `.pill`、提示条走 `.notice`，`.b`/`.strip` 不再出现。

## Impact

- **server/frontend**：`src/design/base.css`（令牌、共享段、删 `.b`）、`src/design/dashboard.css`（删 `.strip` 段）、8 个 `.b` 调用文件、6 个 `.strip` 调用文件（ActivateCodeForm / ChangePasswordForm / SecurityForm / LoginPage / RegisterPage / AuthPage）、`scripts/design-vocab.mjs`、`package.json`（+`design:cross`）。
- **client/frontend**：仅 `src/design/base.css` 共享段镜像（红线：共享段只改一端不得提交）与 `scripts/design-vocab.mjs` 禁令同批、`package.json`；**不动任何 C端调用点**，镜像均为增量定义或注释标记，预期像素零波动。
- **仓库根**：新增 `scripts/design-cross.mjs`（openspec/config.yaml 引用路径即仓库根，落位须一致）。
- **验证面**：双端 `design:lint` + `design:cross` 绿；C端 `design:check` <0.2%（证明镜像无视觉影响）；`vue-tsc`/`tsc --noEmit` 绿；S端 e2e 已确认无 `.b`/`.strip` 选择器耦合（grep 零命中），PR CI 照跑兜底；S端前后截图对照入 change 目录（S端无 parity 门禁，截图即一致性证据）。

## Design Impact

- **受影响端**：S端（实质改动方）；C端仅共享段镜像 + 词汇禁令同批（无用户可见变化）。
- **受影响屏/弹层清单**：控制台四卡（授权 LicenseCard、设备 DeviceCard、账户 AccountPage、布局 DashboardLayout）、授权详情页 LicensePage、认证流三页（登录/注册/激活 AuthPage）、落地页（HeroSection 徽标、RoadmapSection 计划 tag）、下载弹窗 DownloadModal（骨架屏）、全局 toast。
- **对象状态（对照状态语言总表）**：徽标语义映射——「当前设备/套餐/规划中」→ `.pill-tag`（中性）、「有效期内/已激活/注册试用」→ `.pill-status ok`、「已过期」→ `.pill-status err`、计数类 → `.pill-count`；提示条四语气 info/ok/warn/err 原值平移仅更名；骨架加载态取值归一 0.45。
- **是否触碰共享段**：是。两端 base.css 同一次提交内成对落笔，并以 design-cross 零差异为过门条件。
- **是否需要原型先行**：S端无原型基线，免原型；以两端渲染截图对照为证。C端镜像不动调用点，用 design:check <0.2% 证明零视觉影响。
- **设计工件由谁产出**：实现侧自查——cross-end.html §3.1/§3.2 已给出 `.pill` 角色语气网格与 `.strip→.notice` 迁移映射表，uikit/Pill.tsx、uikit/Notice.tsx 提供实物参照，本 change 无新视觉决策，不需要设计侧会话。
