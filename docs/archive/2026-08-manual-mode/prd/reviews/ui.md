# UI 设计师评审：爱小说 C 端改版（视觉 / 组件一致性）

> 角色：UI 设计师（design-ui-designer）
> 日期：2026-08-10
> 范围：docs/prd/ui-design.md §3、PRD.md §4/§6、pages/01–04 高保真、prototype.html、reviews/architect.md（C1–C6）、reviews/consensus.md
> 视角：视觉与组件一致性（非交互逻辑）；聚焦非 AI 参与的基础能力 + 页面 UI&UX
> 结论：视觉评审。与 architect.md 的 C1–C6 对齐，重点确认 C6「两栏 + 底部进度条」的视觉可行性。

---

## 1 总体结论（一句话）

**四页高保真在「正文优先、暖色低刺激、状态可见、允许旁路」上方向正确、底子扎实，但存在一个必须在开发前解决的顶层视觉风险——高保真页全部使用 Tailwind 原生 stone/amber 色板，而不是现有 daisyUI 的 `parchment`/`novelforge` 主题 token；若照 mockup 直译，将与现有组件（Navbar / StructureTree / ChapterEditor）形成两套色板并存的割裂，叠加 02-writing 三栏与 C6 的冲突、03-settings 的 6/7 进度错位，需先做一轮 token 映射 + 状态语言 + 组件基元收敛。**

---

## 2 优点（具体，引用 ui-design / 高保真页）

1. **「状态可见」三态语言方向正确**（ui-design §1/§3.1）。03-settings 树节点用 `○ 未填 / ● 进行中 / ✓ 已确认` + 右侧彩色状态字（`text-emerald-600` / `text-amber-600` / `text-stone-400`），04-outline 卷/章用 `✓已保存 / 未确认 / 已确认 / 待配章纲`，与 spec 的 ghost/warning/success 三态语义一致；保存状态（02/prototype 的「编辑中…」→「已自动保存 ✓」，emerald/amber 切换）与现有 ChapterEditor 的 `saveStatusColor` 状态机（primary/warning/success/error）同构。
2. **四层栏雏形正确**（PRD §4.1 / C4）。02-writing 已实现「应用栏 h-11 → 小说栏 h-12 → 面包屑 h-9 → 两栏 body」的层级，面包屑把层级锚点放在正文工作台（`bar-volume-title / bar-chapter-title`），与 C4「仅正文工作台渲染面包屑」吻合，且专注模式下它是唯一层级锚点。
3. **正文工作台形态收敛到位**（ui-design 屏5 / C6 前半）。02-writing 左树 `w-60` + 编辑器 `flex-1`，正文区 `max-w-3xl mx-auto serif text-[17px] leading-[2]`，正是「正文优先、信息密度适中」的桌面长时场景。
4. **配置抽屉模式是好的组件雏形**（02-writing drawer）：`fixed inset-y-0 right-0 w-[400px]` + `translate-x-full transition-transform` 右侧滑入、顶栏（标题 + 关闭）、表单区、底栏（取消 / 保存 + 去写正文），抽屉互斥（`closeDrawer` 联动），卷/章免费字段与「属 PRO」内联注释（`text-[11px] text-stone-400`）是 C1 免费/PRO 边界的正确示范。
5. **暖色低刺激基调自洽**（ui-design §1.4）：stone-100 背景 + 白色卡片 `rounded-xl border shadow-sm` + serif 标题，与现有双主题（parchment 羊皮纸暖白 / novelforge 深夜书房）的暖色文学气质方向一致；圆角（`rounded-lg/xl`）、边框、间距节奏（p-6 卡片 / space-y-4 表单）在四页间基本统一。
6. **原型提供两个好模式**（prototype.html）：① 屏6 写作屏的次级入口条「高级配置（可选）：设定 / 大纲」+「返回正文 →」（C5 落地形态）；② tier-toggle「🔒/✨」付费标识切换（免费/PRO 显隐的呈现参考）。

---

## 3 视觉 / 组件问题清单（按严重度）

### 3.1 严重（阻塞「一套 UI 两种状态」原则 / 可访问性红线）

**S1. 高保真页用 Tailwind stone/amber 原生色板，而非现有 daisyUI 主题 token（最重要）**
- 位置：pages/01–04、prototype.html 全部页面（`bg-stone-100`、`text-stone-800`、`bg-amber-600`、`bg-amber-100`、`text-emerald-600`…）；对照 `client/frontend/tailwind.config.js` 的 `parchment`/`novelforge` 主题。
- 问题：ui-design §3.3 明言「全部 daisyUI 组件，不引入新色板/字体」，但四页无一使用 token。`amber-600`（#d97706）+ 白字按钮的对比度约 3.2:1（<4.5:1，普通文本不达标）；而主题 `parchment.primary`（#8b6914）+ `primary-content`（#faf6ee）约 4.7:1，达标且更贴合暖色文学风。若开发照 mockup 直译，会与现有 daisyUI 组件（Navbar `bg-base-200/80`、StructureTree `bg-primary/10`、ChapterEditor `badge-warning`）两套色板并存。
- 修改建议：开发前建立一张「mockup → token」映射表并落到实现：`amber-600/700`→`primary`；`stone-100`→`base-100`、`stone-800`→`base-content`；`emerald-*`→`success`；`amber-50/100`（选中/进度）→`primary/10`、`primary/5`；`text-stone-400/300`→`base-content/60`、`base-content/40`。四页在 light（parchment）与 dark（novelforge）双主题下都要验收。**这条不解决，后续所有组件的一致性都是空中楼阁。**

**S2. 02-writing 仍是三栏（右侧「本章进度」卡），与 C6 两栏冲突**
- 位置：02-writing.html L104–120 `<aside class="w-60 …">`（22% 进度卡 `side-progress-pct` / `side-progress-bar`）。
- 问题：architect/consensus C6 已裁定「两栏 + 底部进度条，不设常驻右栏」，02 是唯一仍带右栏的高保真，是 PRD §4.2 早期形态，直接实现会挤压编辑器（1280 下编辑器仅剩约 800px）。同时 02 的底部状态栏（L98–101）只有「字数 + 保存状态」，没有进度。
- 修改建议：删右栏；把进度条并入底部状态栏（见 §4.1 可行性结论）。02-writing 应从「三栏定稿页」标注为「待按 C6 收敛」。

**S3. 免费/PRO 呈现规则不统一：隐藏 vs 🔒 vs 文本注释三套并存**
- 位置：02-writing（免费无 AI 按钮）、03-settings（各面板「免费模式：…属 PRO」内联文本）、prototype（tier-toggle：免费 `🔒 AI 生成正文（PRO）` + `opacity-50`，PRO `✨`）、04-outline（无免费/PRO 标注，全字段展示）。
- 问题：同一「PRO-only」信息，一处隐藏、一处灰锁、一处纯文字、一处无标注。C1 要求「PRO 字段隐藏或 🔒」，缺一个统一的 FeatureTier 呈现规则；纯 `text-stone-400` 小字也容易被当成脚注而非状态。
- 修改建议：定一条规则并全站复用——① 可操作性入口（AI 按钮、题材级配置折叠）免费态显示为「🔒 + 名称」的禁用态（`btn-disabled` + Lock 图标）；② 表单内 PRO 字段统一用「`badge-outline` + 🔒 + 字段名」置灰提示（`opacity-60`），而非正文小字；③ 完全隐藏仅用于「免费根本不该感知」的内部项。建议收敛到 `FeatureTier` 组件统一消费，与 architect C1/C5 一致。

### 3.2 高（明显偏离规格或四页互斥）

**H1. 03-settings 进度 6/7 错位 + 缺「反AI味」节点**
- 位置：03-settings.html。树只画 6 项（L39–45，缺反AI味）；顶部标签 `设定 3/6`（L30）但 JS 按 `n/7` 写文本（L157）、按 `n/6` 算宽度（L156）、`settingConfirmed` 只有 6 个元素。
- 问题：视觉上「条宽 43% = 3/7，标签却是 3/6」，条与文字互相矛盾；全确认后「6/7」与树 6 行不一致。architect R3/C2 已点名，但那是逻辑层，**视觉层更要命的是用户看到的进度与树节点数对不上**。
- 修改建议：树补「⑤ 反AI味」，顺序对齐 canonical（题材/简介/世界/风格/反AI味/伏笔/角色），除数与标签统一为 7；进度条满 7 时切 `success` 色（见 M4）。可后补节点（伏笔/角色）的「可后补」chip 保持 ghost 色。

**H2. 状态语言与徽标形制不统一（三态 vs 四标签；方块 vs 胶囊）**
- 位置：03-settings 树（`○/●/✓` 前导符号 + 彩色标签）、04-outline 章节点（无前导符号，纯文字 `待配章纲/已确认/未填写`）、02-writing 章节点（`📦 已归档` / `未归档` badge，`bg-stone-200` vs `bg-amber-50`）。
- 问题：同一「节点状态」在四页用三种视觉：前导符号、纯文字、emoji badge；且 `badge` 形制 mockup 为 `rounded`（4px）方块，现有代码用 daisyUI `badge` 胶囊（rounded-full）。"未确认"（04）与"进行中"（03）同义不同词。
- 修改建议：统一为 daisyUI `badge` 胶囊 + 前导符号三态：`badge-ghost`（○ 未填）、`badge-warning`（● 进行中）、`badge-success`（✓ 已确认），归档另用 `📦 badge-neutral`。「待配章纲」映射为「进行中」语义或作为子状态但沿用 warning 色；词汇表定为 未填/进行中/已确认/已归档 四个，全站唯一。

**H3. 应用栏/页面级 chrome 不一致：01-list 无应用栏，03/04 缺主题切换与设置**
- 位置：01-list（独立页面，无 logo/应用栏，直接 `我的作品` 大标题）；03-settings / 04-outline 顶栏把「logo + 书名 + 返回正文」压成一行（`h-auto`），无「设置」、无 ThemeToggle；02-writing 应用栏有 `我的作品 / 设置` 但无 ThemeToggle。
- 问题：现有 app 所有页都有 Navbar（含 ThemeToggle，双主题可切）。mockup 把主题切换丢掉了——这意味着 dark 主题（novelforge）下四页视觉完全未定义，双主题体验断裂；01-list 与应用栏体系不一致，与 02/03/04 不像同一产品。
- 修改建议：01-list 也套用应用栏（复用 Navbar 结构）；03/04 顶栏补 ThemeToggle（与 02 一致），或明确「高级配置视图采用精简栏」并在精简栏内仍保留主题切换。所有页面亮/暗两主题各验收一次。

**H4. 功能文本对比度不达 WCAG AA（stone-300/400 用作文本）**
- 位置：02-writing 小说栏「免费模式 · 无需设定，直接写」`text-stone-300`（L29，约 1.9:1）、面包屑分隔 `/` `text-stone-300`、底部状态栏 `text-stone-400`（约 2.9:1）、03 进度标签 `text-stone-400/500`、04「缺：情感基调、必要变化」`text-red-500`。
- 问题：这些是承载信息的文本（免费提示、缺字段列表），不是纯装饰；10–12px 下 1.9–2.9:1 明显不达标，弱视用户不可读。
- 修改建议：功能文本一律 `text-base-content/60` 或 `text-stone-500`（≥4.5:1）；仅装饰性分隔符可用更低透明度。缺字段提示按 spec §3.2 用 `text-error/90` + 字段 chip（`badge-outline badge-error`），不要裸 `text-red-500`。

### 3.3 中（建议调整）

**M1. 树节点与 hover 操作对键盘不可见 / 不可达**
- 位置：02/04 树节点是 `<div onclick>` 无 `role`/`tabIndex`；「配置 →」「✎」「🗑」全部 `opacity-0 group-hover:opacity-100`；03 设定树同理。现有 StructureTree 的 delete 也是 hover 显现。
- 问题：键盘用户既无法聚焦节点，也永远看不到 hover 才出现的操作；与 PRD §7「键盘可达、焦点可见」冲突。
- 修改建议：树节点用 `<button>` 或 `role="treeitem" tabIndex=0`，hover 显现的操作改为 `opacity-0 group-focus-within:opacity-100`（或始终可见但低对比），确保 `focus-visible` 出现时操作可被发现。对现有 StructureTree 组件做一次 a11y 基线补强。

**M2. 抽屉 / 弹窗缺 focus 管理、Esc、遮罩**
- 位置：02-writing drawer（无遮罩，直接右侧滑入）、modal-versions、04 modal-volume、prototype modal-generate。
- 问题：mockup 只切 class；无 backdrop、无 focus trap、无 Esc 关闭、无 `aria-modal`。抽屉无遮罩时用户难以察觉「模态已进入」，且右侧 400px 面板与编辑器可同时操作（焦点游离）。
- 修改建议：抽屉加轻遮罩（`bg-black/20`）+ 打开时焦点移入、Esc 关闭、关闭后焦点归还触发点；统一为可复用 Modal/Drawer 基元（daisyUI `drawer`/`modal` 或自定义 + a11y 补齐）。

**M3. 主确认与下一步入口语义撞车（都填充 amber）**
- 位置：03「确认完成」`bg-amber-600 w-full`；02 抽屉「去写正文 →」「保存卷配置」`bg-amber-600`；01「继续创作 →」`bg-amber-600`；04「去配章纲 →」`bg-amber-600` + 「保存卷纲」`border-stone-300`。
- 问题：spec §3.2 规定「确认主按钮 = `btn-primary` + CheckCircle2（未确认 Lock）」「下一步入口 = `btn-outline btn-sm` + ArrowRight」。mockup 把「确认」和「下一步」都做成同款填充主色，用户在长表单中分不清哪个是终态确认、哪个是跳转。
- 修改建议：确认 = `btn btn-primary btn-md` + CheckCircle2（未满足前置条件时 Lock 图标）；下一步/去写/去配 = `btn btn-outline btn-sm` + ArrowRight，与主确认区分。

**M4. 进度条组件基元与颜色**
- 位置：03-settings / prototype 进度条为自绘 `w-40 h-1.5 bg-stone-200 rounded-full` + 内层 `bg-amber-500`；ui-design §3.2 spec 用 `progress progress-primary h-1.5`、7/7 切 `progress-success`。
- 问题：mockup 与 spec 基元不一致；`amber-500`（#f59e0b）填充对 `stone-200`（#e7e5e4）轨的对比约 1.8:1，弱视下几乎看不见进度。
- 修改建议：统一为 `progress progress-primary h-1.5`（dark 下用 `primary` 亮化变体）；满 7/7 切 `progress-success`；轨道对比建议用 `base-300`，填充用 `primary`（parchment 下 #8b6914 vs base-300 对比 ≥3:1）。

**M5. 字号/行距分段控件的选中态太弱**
- 位置：02-writing L70–80 字号/行距 `bg-stone-100 rounded-md p-0.5`，选中项 `bg-white shadow-sm text-stone-800`，未选中 `text-stone-400`（≈2.9:1）。
- 问题：选中态仅靠「白底 vs 浅灰底」区分，对比弱且色弱用户难辨；与现有 daisyUI `join` 组件不一致。
- 修改建议：改用 `join join-sm` + `btn btn-sm`，选中项 `btn-active`（primary/primary-content），未选中 `text-base-content/60`；字号 15/17/19px、行距 1.8/2.0/2.2 三档语义保留，选中态对比 ≥4.5:1。

**M6. 02-writing 活动章节字数误用 success 绿**
- 位置：02-writing L56 `text-emerald-600 486字`。
- 问题：字数不是状态，用 success 绿会与「已确认/已保存」语义混淆（绿色在系统里 = 成功/确认）。
- 修改建议：字数一律中性色 `text-base-content/50`；只有归档态、保存态、确认态才用语义色。

**M7. 正文排版参数与现状代码不一致（16px vs 17px）**
- 位置：spec §3.2「默认 17px/2.0、font-serif」；02/prototype `text-[17px] leading-[2]`；现状 ChapterEditor（含专注模式）`text-base`（16px）`leading-[2]`。
- 问题：实现基线是 16px，规格是 17px；专注模式复用 `text-base`，与工作台默认 17px 不一致。
- 修改建议：以 17px/2.0 为默认（`text-[17px] leading-[2]`），字号档位 15/17/19、行距 1.8/2.0/2.2 做成 token；专注模式与普通模式同一默认值。

**M8. 专注模式缺 Esc 退出 + 面板隐藏范围**
- 位置：ui-design 屏5「Esc 退出」；现状 ChapterEditor focusMode（L708–748）无 Esc 监听，且是编辑器自身独立视图而非「隐藏左右栏」。
- 问题：规格要求 Esc 退出；新版工作台下专注模式应隐藏应用栏/小说栏/树/面包屑，仅留 slim bar + 居中正文 + 底部状态栏。
- 修改建议：focus mode 监听 Esc；隐藏所有左右栏与面包屑；slim bar 保留字数 + 保存状态 + 退出；底部保留 C6 进度锚点。复用现状 focus view 但按新四层栏裁剪。

### 3.4 低（打磨）

- **L1** 01-list 阶段标签「写作中」`bg-emerald-50 text-emerald-600` vs prototype「设定中」`bg-amber-100 text-amber-700`——同一卡片语义不同色/词。免费 = 建书即写，建议卡片统一显示「写作中」（green），「设定中」仅 PRO 进行高级配置时出现。
- **L2** 04-outline 树删除用浏览器 `confirm()`，与现有 StructureTree 行内「确认删除?/取消」交互不一致；实现时统一为行内确认，不引入系统弹窗。
- **L3** 02-writing 面包屑 `bar-volume-title` 有 `hover:text-stone-800` 的链接样式但无 onclick，是死交互；要么做成可点（切卷），要么去掉 hover。
- **L4** meta 字号 `text-[10px]`（树标签、状态、字数）与 `text-xs`（12px）混用；建议 meta 统一 ≥11–12px，提升中文可读性。
- **L5** 02-writing 顶部连排 3 条白 bar（应用栏/小说栏/面包屑）+ 工具条 h-9，共 4 条白底 `border-b`，层级视觉难分；建议应用栏用 `bg-base-200/80 backdrop-blur`（复用 Navbar 表面），与小说栏/面包屑（base-100）区分，压缩为 3 条可见层级。
- **L6** 正文树「无正文章节」的空态未设计；新增空态（如「还没有正文，写第一章 →」+ `btn-outline`），呼应「永远知道下一步」。
- **L7** 归档只读提示条（02 `readonly-banner` `bg-stone-100 text-stone-500`）与 spec「顶部提示条」一致，但缺 icon；建议用 `badge-neutral`/📦 + `text-base-content/60`，与树节点归档符号同源。
- **L8** 免费限 1 本（01-list L47「免费用户可创建 1 本小说」）是开放问题 R2/O1；视觉上「+ 开始新小说」虚线卡未做满额禁用态，建议先按现状标注，口径确认后补 `disabled` 态。

---

## 4 对 C1–C6 的视觉影响确认

### 4.1 C6 两栏 + 底部进度条——视觉可行，给出具体形态

**结论：可行，且比三栏更优。** 1280×800 下去掉右栏（240px），编辑器可用约 1040px，正文 `max-w-3xl`（768px）居中后两侧留白自然，符合「正文优先」；底部状态栏是唯一同时容纳「字数 + 进度 + 保存」的位置（PRD §6 信息去重），专注模式下也持续可见，与 C6 论证一致。

落地形态建议（供实现）：
- 底部状态栏保持 `bg-white border-t px-4`，行高 h-8；左「本章 486 字」（`text-xs text-base-content/50`），中「进度条 `progress progress-primary h-1.5 w-40` + `22% · 目标 2200 字`」（`text-xs text-base-content/50 tabular-nums`），右保存状态（`text-success/70` 已保存 / `text-warning` 未保存 / `text-primary` 保存中）。
- 进度条用 `progress-primary`（替代 amber-500，见 M4）；满 100% 不切 success（正文无「完成」终态，避免与设定 7/7 的 success 语义冲突——正文进度是连续量，设定是完成量）。
- 删除 02-writing 右侧 `<aside>`；保留 `readonly-banner` 在工具条与编辑区之间。

### 4.2 其余 C1–C5 视觉影响

- **C1（设定入口可见但折叠）**：02-writing 小说栏右侧目前只有 `text-stone-300` 的「免费模式 · 无需设定，直接写」——需新增「高级配置」次级入口（建议放小说栏右侧：`btn btn-ghost btn-sm`「高级配置 ▾」下拉出「设定 / 大纲」；或复用 prototype 屏6 的次级入口条），免费提示降为 `text-base-content/50` 或 badge。03-settings 各面板的「属 PRO」内联提示保留但统一为 🔒+badge 形态（S3）。
- **C2（统一 7 项）**：03-settings 树补「反AI味」并修 6/7 进度（H1）；进度满 7/7 切 success（M4）。树侧栏 `w-56` 容纳 7 行无压力。
- **C3（双轨：抽屉 + 面板）**：两套表面需共享表单基元（label `text-xs font-medium` + input `input-bordered`）、标题（serif `text-xl`）与状态 badge（H2），抽屉 `w-[400px]` 与大纲面板 `max-w-2xl` 视觉同源。当前 02 抽屉与 04 面板的字段风格已接近，只需统一 badge 形制与 footer 按钮语义（M3）。
- **C4（面包屑仅工作台）**：02 已有 h-9 面包屑，03/04 不渲染（其层级在左树）——与去重原则一致。注意面包屑不要与编辑器顶部 h2 章节标题重复层级（h2 是正文标题，可保留）。L5 建议面包屑与小说栏在视觉上能区分（背景/间距）。
- **C5（入口按钮 + 独立视图）**：02 需补「高级配置」入口（同 C1）；03/04 已带「返回正文 →」（`text-amber-700`）。建议「返回正文」在 03/04 顶栏用 `btn btn-ghost btn-sm` 而非纯文字链接，点击区域更大。视图四态（workbench / advanced-settings / advanced-outline / archives）之间切换需统一过渡（页面级 `animate-fade-up`，现有 index.css 已有）。

---

## 5 一致性检查

### 5.1 四页之间

| 维度 | 01-list | 02-writing | 03-settings | 04-outline | 判定 |
| --- | --- | --- | --- | --- | --- |
| 应用栏 | 无 | 有（我的作品/设置） | 精简顶栏 | 精简顶栏 | ✗ 不一致（H3） |
| 色板 | stone/amber | stone/amber | stone/amber | stone/amber | ✗ 全部非 token（S1） |
| 主按钮 | amber 填充 | amber 填充 | amber 填充 | amber 填充 + outline | ✗ 确认/下一步语义撞车（M3） |
| 节点状态语言 | 阶段标签（写作中） | 归档态（📦/未归档） | 三态（○●✓） | 四标签（待配/确认/未填） | ✗ 三套形态（H2） |
| 面包屑 | — | 有 | 无（左树定位） | 无（左树定位） | ✓ 符合 C4 |
| 进度条 | — | 右卡（应删） | 顶条 6/7（bug） | 无 | ✗ 基元/口径不一（M4/H1） |
| 保存状态 | — | 已自动保存 ✓ | 已保存 ✓（badge） | — | △ 词形微异 |
| 正文排版 | — | 17px/2.0 serif | — | — | △ 与现状 16px 不一致（M7） |

### 5.2 与现状代码之间

- **色板**：现有 `tailwind.config.js` 双主题（parchment/novelforge）与 mockup stone/amber 不互通——最大断层（S1）。
- **组件基元**：现有用 daisyUI `navbar`/`badge`/`btn`/`input`/`select`/`progress`；mockup 全自绘。实现时应以 daisyUI 基元承载 mockup 视觉（badge 胶囊、btn 语义、input-bordered），只把颜色落到 token。
- **树**：现有 StructureTree 已支持 badge（`badgeColor`+20）、hover actions、行内删除确认、双击改名；mockup 的「配置 →」「✎/🗑」应映射到现有 `node.actions` / `onDelete` 底座，不新造树组件（architect §6 亦如此判断）。补：hover 显现需 `focus-within` 可发现（M1）。
- **保存状态机**：现有 ChapterEditor `已保存/未保存/自动保存中/保存失败`（primary/warning/success/error）与 mockup「编辑中…/已自动保存 ✓」语义同构，实现时统一词形为现有四态（建议「已保存」替代「已自动保存 ✓」）。

### 5.3 状态语言统一表（建议全站唯一）

| 状态 | 视觉 | daisyUI 基元 |
| --- | --- | --- |
| 未填 | ○ | `badge badge-ghost badge-xs` |
| 进行中 / 待配 | ● | `badge badge-warning badge-xs` |
| 已确认 | ✓ | `badge badge-success badge-xs` |
| 已归档 | 📦 | `badge badge-neutral badge-xs` |
| 保存中 | spinner | `loading loading-spinner loading-xs text-primary` |
| 未保存 | — | `badge-warning` |
| 保存失败 | 重试 | `text-error` + 重试入口 |
| PRO-only | 🔒 | `opacity-60` + Lock + `badge-outline` |

---

## 附录：mockup → daisyUI token 映射（开发前必读）

| mockup（现状高保真） | 语义 | parchment / novelforge token |
| --- | --- | --- |
| `bg-amber-600 text-white`（按钮） | 主操作 | `btn btn-primary`（primary/primary-content） |
| `bg-amber-100`（选中态/树高亮） | 选中 | `bg-primary/10 text-primary` |
| `bg-amber-50`（进行中底） | 进行中弱底 | `bg-warning/10` |
| `bg-stone-100`（页面底） | 页面底色 | `bg-base-100` |
| `text-stone-800/700` | 正文/标题 | `text-base-content` |
| `text-stone-500/400` | 次级文本 | `text-base-content/60`、`/50` |
| `text-stone-300` | 装饰 | `text-base-content/30`（不作功能文本） |
| `text-emerald-600`（确认/字数） | 成功 / 中性 | `text-success`（仅确认态）；字数用 `text-base-content/50`（M6） |
| `bg-stone-200`（轨道） | 进度轨道 | `progress progress-primary h-1.5`（满 7/7 `progress-success`） |
| `serif text-[17px] leading-[2]` | 正文排版 | 字号 15/17/19、行距 1.8/2.0/2.2 token，默认 17/2.0 |

---

**UI 设计师**：design-ui-designer · 2026-08-10
**实现前动作**：① 建立 token 映射并双主题验收（S1）；② 02 按 C6 改两栏 + 底部进度条；③ 03 修 6/7 进度并补反AI味；④ 状态语言与 badge 形制统一（H2）。
