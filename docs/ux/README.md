# docs/ux — 全端 UX 结论与组件候选集（C端 × S端）

C 端前端设计审计、统一设计语言规范与统一组件方案，以及 C/S 两端视觉一致性方案。基于 `client/frontend`（React 19，2026-08-25，Open Design v2 换装 #181~#187 之后）与 `server/frontend`（Vue 3 + Tailwind 4 仅布局）当前代码。

## 文档索引

| 文件 | 内容 |
| --- | --- |
| [`audit.html`](./audit.html) | 路由与用户路径、弹层矩阵、A–K 逐页评估（含文件行号证据）、业务覆盖矩阵、P0–P3 缺口清单 |
| [`design-language.html`](./design-language.html) | 8 条设计原则、色彩/字阶/几何令牌、状态语言总表（§5 核心）、组件词汇、布局骨架、AI 四形、门控视觉、删除分级、文案术语表、落地路径 |
| [`components.html`](./components.html) | 组件现状盘点（现成 / 有类无壳 / 缺失三层）、六个缺口的实物演示与调用方式、迁移映射表 |
| [`cross-end.html`](./cross-end.html) | **全端一致性**：三层契约模型（L1 逐字同 / L2 同名同义 / L3 白名单）、已同源清单（两端逐字比对）、8 处漂移裁决（方向 + 文件行号证据）、跨框架壳对照（React × Vue）、特殊场景白名单、`design:cross` 防漂移机制、P0–P2 落地批次 |
| [`handoff.md`](./handoff.md) | **设计侧 → 产品经理 agent 的移交入口**：完成度速览、事实源地图、日常动作、裁决规则与红线、待办 backlog（可直接转 openspec change）、悬而未决清单、验收命令速查 |
| [`uikit/`](./uikit/) | 可搬运的 React 候选组件集 + CSS 补丁，搬运顺序见其 [README](./uikit/README.md) |

四份 HTML 可直接双击打开阅读；`components.html` 内含可交互演示（确认弹窗、Toast、撤销窗口）。

## 本目录是设计标准的唯一权威（2026-08-27 起）

分工只有两层，各居其所：

- **标准＝本目录**：规范正文 `design-language.html`、全端一致性裁决 `cross-end.html`、候选实现 `uikit/`。它派生出唯一的机器强制层——两端 `scripts/design-vocab.mjs`（禁令同源，改动与标准同批）。
- **运行资产＝`../design-c/`**：仅原型像素基线 `prototypes/*.html`、比对产物 `baselines/`、登记簿 `prototypes/ADJUSTMENTS.md`。这些是被 `design:check` 消费的资产，不承载标准。
- v1 词汇表（原 `design-c/DESIGN.md`，daisyUI 双主题/lucide 口径）与 v1 屏规格已随 #181~#187 换装失效，归档于 `../archive/design-c-v1/`，不要再引用。
- 流程照旧：先改 `../design-c/prototypes/*.html` 并在 `prototypes/ADJUSTMENTS.md` 登记，再改实现 → `design:check` 全绿（<0.2%）。**本目录所有文档都还不是已登记原型**，落地任一条目前先把对应段落并入原型并登记。

## 结论速览

### 全端一致性 · C端 × S端（2026-08-27 新增）

- **地基已经同源**：两端 `src/design/base.css` 的令牌段与按钮/弹窗/表单/toast 基础类逐字相同（约 80%）——「全库一致」是收敛问题，不是重建问题。
- **8 处语义漂移待收敛**：徽标（C 13 种自制 vs S `.b` 单基类）、提示条（`.notice` 2 档 vs `.strip` 4 档 → 统一 `.notice.info/ok/warn/err`）、表单错误态（C 完全缺失，S 的 `.f-err/.has-err` 上移共享段）、骨架屏取值、面板卡归属、toast warn 档、`--on-accent` 令牌（两端共 8 处用 `var(--surface)` 冒充反白）、空态动作槽。逐条裁决见 `cross-end.html` §三。
- **最大风险 = 零防漂移机制**：「同源」目前靠人肉复制。解法是共享段打 `@cross-begin/@cross-end` 标记注释 + `scripts/design-cross.mjs` 比对脚本挂进门禁（§六 M1）；配套图标公共键断言（M2）与禁令正则互通（M3）。
- **跨框架边界**：React/Vue 不共用组件代码，一致性的判定层是**类名契约**——同一份 HTML 片段贴进任一端渲染须逐像素相同；壳层刻意不对称（S 端保留 AppButton 等 Vue 薄壳，C 端维持直接用 CSS 档位不包壳）。
- **仲裁规则**：两端取值不同且都合规时，以受 parity 门禁约束的 C 端为准——改 C 要过原型与 design:check，改 S 不用，永远向低成本一侧收敛。
- **落地批次**：P0 机械令牌批（半天，含建立 cross 基线）→ P1 语义收编批（pill 家族 / notice 四语气 / 表单错误态）→ P2 机制完善批（图标断言 / 共享规则模块 / ~~OpenSpec 升格全端~~ **已完成**）。
- **工作流接入（2026-08-27 完成）**：`openspec/config.yaml` 与 `design-system` capability（6 条 Requirement）已扩为双端口径——任何 S端 UI 变更在 propose 时同样被要求写 Design Impact 与跨端判定；触共享段的必须双端同改并给出 design:cross 结论；语气词表 info/ok/warn/err 成为 proposal 层的禁令而非口头约定。设计侧交接走 `/ux:design-brief <change-id>`（`.zcode/.claude` 两处同名命令）。

### C 端遗留缺口

### P0 · 功能断裂（本周可修）

1. `ContrastPreviewModal.tsx:31` 引用未定义的 `var(--font-serif)` → 改 `--font-display`（核心阅读弹窗字体静默退化）
2. `ModelSettingForm.tsx:81` 在 HashRouter 下写 `<a href="/config">` → 改 `"#/config"`（点击整页跳出应用）
3. 免费用户没有任何引导卡（`OnboardingCard` 挂在 `ProContainer` 内，免费态整树为 null，`ProContainer.tsx:11`）
4. 书架满额时隐藏而非锁定新建/导入入口（`NovelListPage.tsx:155,218`），用户撞额度墙无解释无出口
5. 目标字数两套默认口径：OgPane 留空 2500 vs Rail 回落 2000
6. 无兜底路由（`App.tsx`），未知地址白屏

### P1 · 设计语言收口（一个迭代内）

- destructive 归一：卡片菜单危险项从 `--warn` 迁到 `--err`，确立「红 = 不可逆 / 即时生效」（N6）
- 5 处 `window.confirm` 收编为 ConfirmGuard 弹窗（`uikit/Confirm.tsx`）
- 13 种胶囊收敛为 `.pill` 三角色 × 五语气（`uikit/Pill.tsx`）；先修 `.inv-chip` 与 `.spin` 两处同名不同值
- 提示词页签对免费改为「锁定可见」，兑现「同一界面」承诺
- 右栏「规划中的能力」改一行折叠且口径对齐 PRD；卷纲撤掉永久「草稿」警示徽标
- 设定面板间 dirty 守卫与 3s 自动保存二选一；输入态 focus 改 `:focus-visible`，生成/保存态补 aria-live

### P2 · 令牌落地（配合 parity 流程）

字号 22 档字面量 → 8 档命名、radius 补 `sm/pill`、间距定 4pt 栅格并统一 `--field-gap`、z-index 与 scrim 令牌化、webfont 决策（打包子集 Noto Serif SC 或写实回退栈）。

### P3 · 缺失业务面预留

剧情推演入口（右栏沙盘模式）、导出备份入口（BookPrefsModal 一行）、归档更新回路界面（复用 VersionDiff 语言）、预览搜索/跳章、「本地可用 · AI 不可用」离线提示条。

## 组件问题的一句话答案

**有现成的一半：** `Modal`、`toast`、图标注册表、settings 表单字段族、UndoToast 这 5 个 React 原语质量高且已全站复用；另有约 10 个 CSS 小件（`.btn` 家族、`.input`、`.empty*`、`.notice`、`.save-state`、`.chip` 等）够用但无封装。
**另一半正在各自为政：** 胶囊零共享基类、三态点被 `.ch` 作用域锁死（`book.css:97-100`）、保存四态只在 `ChapterWorkspace.tsx:428-434` 手写一遍、提示条只有 warn/info 两档、空态各写各的、确认弹窗走原生。
六处缺口已在 `uikit/` 给出可直接搬运的实现；同时明确不建议抽象 Button/Input/Tabs（CSS 档位已齐全，包一层只会让 IDE、grep 和 design-lint 同时失明）。

## 验收口径（沿用既有流程）

任何一条落地都要同时满足：原型先行更新（ADJUSTMENTS.md 登记）→ `npm run design:lint` 通过 → `npm run design:check` 全绿（像素差 <0.2%）→ `npx tsc --noEmit` + 相关 e2e 更新后通过。
