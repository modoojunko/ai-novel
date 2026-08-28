# 前端可行性评审：免费基础能力 + 页面 UI&UX

> 角色：前端技术负责人 · 2026-08-10
> 评审对象：`docs/prd/tech-frontend.md`（前端技术方案初稿）
> 依据：`docs/prd/reviews/consensus.md`（C1–C6）、`docs/prd/reviews/architect.md`、`docs/prd/PRD.md`、`docs/prd/ui-design.md`，以及现状代码 `client/frontend/src/**`（已逐文件实读核对）
> 聚焦：非 AI 参与的基础能力 + 页面 UI&UX；前端能否落地、怎么落地更省

---

## 1. 总体结论

**方案可行，方向正确，可进入实施；但「contenteditable 编辑器的受控更新策略」是未解决的最大技术风险，必须在开工前定死，且「正文树只显示有正文章节」与「卷全字段面板」两处被明显低估。**

一句话：四态视图模型、FeatureTier 两态、ProseEditor 纯文本模型、useWorkbench/useChapterData 抽取都成立且与现状代码吻合；修正「contenteditable 受控回写/IME/游标」「树过滤的空章孤儿」「卷全字段面板无现成复用」「§7 端点路径与现状不一致」四个点即可落地。

---

## 2. 现状基线核对结果

以下结论全部基于对 `client/frontend/src/**` 的实际阅读。

### 2.1 tech-frontend 判断准确的部分

| 判断 | 核对结果 |
| --- | --- |
| `NovelPage.tsx` 约 1100 行巨石、TABS 六 tab、isNew→settings 默认落点 | **准确**。`TABS`（settings/volume/chapter/prompts/writing/archives）定义于 L56；`useState<TabId>("settings")` L94；L231–237 存在 `isNew && tab==="writing" → setTab("settings")` 强制回设定。 |
| `App.tsx` 死子路由 | **准确**。`/novel/:id` 下 `settings`/`settings/world`/`settings/style`/`settings/anti-ai`/`settings/hooks`/`outline`/`prompts`/`write`/`archives`/`threads` 全部 `Navigate to=".."`（L36–45），可安全删除。 |
| tier 散落 | **准确**。`NovelPage` L121–125 与 `NovelListPage` L69–72 各自 `api.post("/auth/verify")` 取一次，不共享。 |
| `StructureTree` 有 actions/onDelete/双击改名底座，但无行内新建/父节点删除/hover 配置 | **准确**。`editable`/`onTitleChange`/`onDelete`/`actions`/`locked` 均已具备；但删除仅对叶节点（`!hasChildren`，L127/L207），卷节点不能内联删；无「+ 新建章」行内入口；`actions` 可模拟 hover 配置按钮（L243–259），但缺「配置 →」专属形态。 |
| `ChapterEditor` textarea、3s 防抖、saveFnRef/dirty 快照 | **准确**。L903 textarea 正文；L277 `setTimeout(...,3000)`；L127–130 `isDirty`；L243–269 `saveFnRef`。 |
| 专注模式在 `ChapterEditor` 内部 | **准确**。`focusMode` 为组件内 state（L113），L708–749 专注态在编辑器内渲染，未提升。 |
| `EmptyState` 有设定未完成门控 + 「先去设定」 | **准确**。L25–61 在 `!settingsComplete && !bypass` 时渲染「设定尚未全部完成 + 先去设定」。 |
| 无 contenteditable 库、daisyUI 版本 | **准确**。`package.json` 仅 clsx/diff/lucide-react/react/react-dom/react-router-dom/tailwind-merge，无 @tiptap 等；daisyUI `^4.12.24`（devDeps）。`drawer`/`progress`/`badge`/`join`/`menu`/`modal` 基元均可用。 |
| `useOutline` 已消费 `/tree` | **准确（但见 2.2-1 补充）**。`useOutline.refetchTree` L159 已 `GET /novels/:id/tree`；`VolumeEntry`/`ChapterMetaEntry` 类型已含 `ref/title/summary/chapter_count/chapters{ref,volume,chapter,title,status,word_count}`。 |
| 免费限 1 本 | **准确**。`CreateProjectModal` L109–111 `freeLimitReached = tier==='none' && novelCount>=1`；`NovelListPage` L112 隐藏创建按钮。 |
| `useOnboarding` 已是 7 项口径 | **准确**。`SETTINGS_TYPES = ["synopsis","genre","world","style","anti-ai","hooks","characters"]`（L7），与 C2 一致；注释明示 ai-model 不参与。 |

### 2.2 与代码不符 / tech-frontend 未言明的偏差（重要）

1. **`/tree` 现状是文件扫描，不是 DB，且缺 `has_prose`/`archived`、`word_count` 口径与编辑器不一致。**
   - `novels/service.py build_project_tree` 逐卷读 `volumes/*.yaml` 内嵌 `chapters` 派生，无 DB 表；章节元数据含 `word_count: len(ch.get("prose",""))`（**含空白原始字符数**），而编辑器 `ChapterEditor.countChars` 是去空白计数——**同一章树显示字数与编辑器实时字数必然不一致**。
   - tech-frontend §7 契约 1 要求 `/tree` 增 `has_prose` + `archived` 并对齐 `word_count`，这是真实缺口，不是「已具备，只需切 DB」。前端 WritingTree 的过滤/徽标强依赖这两个字段，后端未就位前步骤 3/5/8 会被卡住。
2. **设置树节点身份与 C2 7 项不一致。** 现状 `NovelPage.SETTINGS_TREE_ITEMS`（L75–83）= genre/world/style/anti-ai/hooks/characters/**ai-model** 共 7 项，**synopsis 不是树节点**（简介卡 `SynopsisCard` 常驻于 `SettingsFormField` 顶部）。C2 7 项 = 题材/简介/世界/风格/反AI味/伏笔/角色：需把 **ai-model 移出树、synopsis 新增为树节点**。且 `SettingsFormField` 的 characters 分支（L35–42）已内置渲染 `SynopsisCard`，若 synopsis 独立成节点，要避免简介卡在角色节点内重复渲染。tech-frontend §2.2 #11 只说「复用 SettingsFormField」，未点出这层重映射。
3. **卷/章写端点在现状与 §7 契约不一致。** 现状：卷 `PUT /novels/:id/volumes/{filename}`（`VolumeEditor` L112）、章 `PUT /novels/:id/chapters/{ref}`（`ChapterEditor` L257 / `useOutline.saveChapter`）。tech-frontend §7 契约 3 写的是 `PUT /volumes/:ref`、`PUT /chapters/:ref/outline`——**路径是新的**。对章而言「双轨同一端点」现状已通过 `PUT /novels/:id/chapters/{ref}` 成立（抽屉的 summary 与大纲面板的 outline 都写它）；对卷而言抽屉/面板应继续复用 `PUT /novels/:id/volumes/{filename}` 即可，**无需新增端点**。建议 §7 契约路径按现状端点收敛，避免后端凭空多做一套。
4. **保存状态模型是 4 态，不是 3 态，且无「重试」UI。** `ChapterEditor` L221–235：自动保存中/保存失败/未保存/已保存；保存失败只有文字，**无重试按钮**。tech-frontend §3.2 的「已自动保存 ✓（2s 后回落）」「失败重试」是新 UI（`OutlineEditor` 已有 2s auto-clear + error 重试范式 L313–323/L762–769，可整体搬运）。
5. **归档后编辑器只读在现状并不存在。** `handleArchive`（`ChapterEditor` L645–661）把 status 置为 archived，但 **textarea 仍可编辑**（无 contentEditable=false 分支）。「编辑器内只读 + 顶部提示条 + 树同步」是**全新工作**，tech-frontend §3.4 按新做处理是对的，但 architect §6 表格「归档只读已具备」是乐观的（具备的只是 `ArchivePage/ArchiveReader` 的归档文件只读，不是编辑器内闭环）。
6. **NovelBar 的「类型」无数据源。** 项目详情响应（`novels/service.py` L131–136）仅 `current_phase/total_volumes/total_chapters/source`，无 `type`/`genre` 展示字段。PRD §4.1 小说栏要「书名 · 类型」，需后端补字段或前端从 settings genre 派生，否则 NovelBar 类型位悬空。
7. **`NovelLayout` 是空壳**（仅 `AuthGuard` + `<Outlet/>`），「保留改造」准确但无可复用内容（除 AuthGuard），项目壳 + LicenseProvider 全新建。
8. **`OutlineOverview` 在新视图无消费点。** tech-frontend §2.3 把它列入复用，但 #14 AdvancedOutlineView 设计是「左树 + 右上下文面板」，不使用卡片总览（`OutlineOverview`/`OutlineVolumeCard`/`OutlineChapterCard`）。应标注「保留不删、新视图默认不消费」。
9. **`client/frontend/AGENTS.md` 是过时误导**：声称「This is NOT the Next.js you know，读 node_modules/next/dist/docs」，但本仓是 **Vite + React 19**，无 Next.js。实施者照读会浪费时间。按「精准修改」我不改它，但建议后续清理或至少忽略。

---

## 3. 前端方案问题清单（P0 / P1 / P2）

### P0（开工前必须定死，否则返工）

**P0-1 contenteditable 的「受控回写」会导致游标跳动/IME 输入损坏——tech-frontend §3.1 没有受控策略。**
`onInput → 序列化 → setProse(plainText)` 若再驱动 React 重渲染回写 DOM（受控 contenteditable），每次按键都会重置光标；中文 IME 组合期（compositionstart/end）的中间态 onInput 会污染 DOM 与字数。
修正建议（定死契约）：
- **DOM→state 单向、state→DOM 仅外部触发**：`ProseEditor` 持有 `contentRef`，仅在载入/`setPlainText()` 时写 `innerHTML`；`onInput` 只序列化到 state（供自动保存/字数），**不让 React 因 state 变化重渲染编辑器 DOM**。
- **IME 守卫**：`onCompositionStart/End` 期间不序列化、不触发防抖保存。
- **粘贴净化**：`onPaste` 拦截，按白名单（p/br/strong/em）转纯文本/段。
- **序列化函数只输出纯文本**：段落按 `\n\n` join，段内换行拍平或转 `\n`，`countChars` 用同一份纯文本——杜绝「HTML 写回 YAML」。

**P0-2 「正文树只显示有正文章节」有空章孤儿 + has_prose 抖动两个洞。**
若过滤掉空章，行内新建的**空章在离开后无法从树找回**；且 `has_prose` 依赖服务端已保存内容（1.5s 防抖），未落盘的首句话会让章节在树上一闪而过。
修正建议：过滤规则改为 **`has_prose || isSelected || 本会话新建`**（新建章至少保留到首次保存）；`has_prose` 定义为「prose 非空」并依赖 §7 契约 1 的字段；若后端短期不齐，前端可降级为「当前卷/章恒显示 + 其余按本地已载入 prose 过滤」。

**P0-3 卷全字段面板（VolumeConfigPanel）没有可复用的表单，工程量被低估。**
tech-frontend #15 写「复用 OutlineEditor 内部表单」，但 `OutlineEditor` 是**章纲**编辑器；卷现状只有 `VolumeEditor`（**摘要级**，title+summary）。卷纲全字段（结构模板/核心冲突/冲突阶梯/信息差/场景卡）**无现成 UI**，需按 04-outline/format-specs 新建表单。
修正建议：把 #15 拆分标注——`ChapterConfigPanel` 可复用 `OutlineEditor`（需改造成右面板形态、去 `onBack`/全页壳），`VolumeConfigPanel` 计为净新增组件 + 新表单基元（Field/ListEditor 可复用）。

### P1（影响体验或易返工）

**P1-1 「四态视图不卸载 Workbench」需要一个明确的挂载策略，且要处理视图切换时的 IME/失焦。**
建议：仅 **Workbench 常驻挂载**（切到 advanced/archives 时用 `hidden` 隐藏，保住 prose 脏状态与光标）；advanced 视图**首次访问懒挂载、离开卸载**（表单廉价、可重载）。若按字面四视图全常驻，`ArchivePage`/`useOutline` 会在进工作台时即发起数据请求，白费流量与挂载成本。另：切视图时若 IME 组合未完成，`display:none` 会中断输入，切换前应 `blur()`/提交。
**P1-2 hooks 不能「条件触发」。** `useNovelState` 是 hook，tech-frontend §4.2「fetchPhaseStatus 改为 tier 条件触发」无法在 hook 内优雅表达。修正：**PRO 才挂载消费组件**（把 `TabProgressButton/GateBanner/OnboardingCard` 收进一个仅在 PRO 渲染的容器），免费态顶层直接不渲染该子树——这也天然满足「不散落 if(tier)」。免费态连 `settings/status` 也可不预取，仅进入 AdvancedSettingsView 时再取（n/7 进度数据源）。
**P1-3 双轨脏状态仍需一条交互规则（R3 的落地点）。** 抽屉（工作台）与大纲面板（高级大纲）各持独立本地表单；虽然分属不同视图很少同时脏，但 `useOutline.saveChapter` 的 merge 语义（`{...existing, ...data}`）在「面板有未保存修改 → 抽屉保存 summary」时会把面板未落盘字段覆盖掉。修正：打开同一章的抽屉/面板前 flush 或 refetch 共享 `chaptersMap` 缓存（`useWorkbench` 持有的那份）。
**P1-4 ProseEditor 对外契约要预留 AI 恢复点。** 现状 AI 流式依赖 textarea `selectionStart`（`cursorPositionRef`/`proseBeforeCursor`，`ChapterEditor` L159–166/L667–669）。contenteditable 化后 cursor 需改为 Range/offset 计算。本交付 AI 隐藏，但 `ProseEditor` 暴露 `getPlainText()/setPlainText()/captureNow()` 时，`captureNow` 必须返回**基于纯文本的 start/end**（而非 DOM 位置），否则 PRO 恢复续写/润色时 `SelectionCapture`（`lib/selection.ts` 的 `{start,end,text,fullText}`）契约崩掉。建议新写 `lib/selectionContentEditable.ts` 并在 `ProseEditor` 内注入，旧 textarea 版保留。

### P2（打磨/口径）

**P2-1 「禁止散落 if(tier==='none')」要限定边界。** 它应约束**功能显隐**（AI 按钮、PRO 字段、提示词入口），但不该把**产品级 license 话术**也塞进 FeatureTier：免费限 1 本（`CreateProjectModal` L109）、试用横幅（`NovelListPage` L87）、「免费可后补」标注是运营/限制判定，不是能力开关。建议 FeatureTier 只放 `lib/features.ts` 能力位；限 1 本与横幅保留直判，否则能力清单会被非能力 flag 污染。
**P2-2 §7 契约路径按现状端点收敛**（见 2.2-3）：章/卷写端点复用现有 `PUT /novels/:id/chapters/{ref}`、`PUT /novels/:id/volumes/{filename}`；`/tree` 增量字段（has_prose/archived/word_count 对齐）才是真正的后端新增。
**P2-3 设置 7 项重映射 + synopsis 防重复**（见 2.2-2）：ai-model 移出树、synopsis 入树；`SettingsFormField` characters 分支的内置 `SynopsisCard` 在 AdvancedSettingsView 中需去掉（或 synopsis 节点单独渲染，避免双份）。
**P2-4 保存态 UI 统一搬运 `OutlineEditor` 范式**（2s auto-clear + error 重试）到底部状态栏；并把「编辑中/已自动保存✓/失败重试」与现状 4 态对齐描述清楚（避免开发按两种口径各做一遍）。
**P2-5 NovelBar「类型」数据源**（见 2.2-6）：后端补项目类型字段，或前端从 genre 设定派生；建议直接列为后端契约项。

---

## 4. 组件清单增删改建议

### 4.1 新建清单（tech-frontend §2.2 16 项）评审

**建议保留（13 项）**：`LicenseProvider/useTier`、`FeatureTier + lib/features.ts`、`NovelBar`、`Breadcrumb`、`Workbench`、`WritingTree`、`VolumeConfigDrawer/ChapterConfigDrawer`、`EditorToolbar`、`BottomStatusBar`、`ArchiveBanner`、`AdvancedSettingsView`、`AdvancedOutlineView`、`EmptyState`（改造）。

**建议合并/降级（2 项）**：
- `SettingsProgressBar`(#12)、`SettingNodeBadge`(#13)：单行进度条与三态徽标，合并进 `AdvancedSettingsView` 内部或抽一个 `settings/SettingNodeBadge.tsx` 即可，不必两个独立组件。

**建议新增（清单里缺的）**：
- **`NovelWorkspace`**（四态视图机）应显式列入组件清单——tech-frontend §1.2 提了拆分但 §2.2 表漏列。
- **`ProseEditor`** 应显式列入——§3.1 有方案但 §2.2 表漏列（它是本次最大新件）。
- **`lib/selectionContentEditable.ts`**（contenteditable 选区捕获）——`lib/selection.ts` 现基于 textarea，必须新增而非改写（旧版 PRO 复用）。

**建议重估**：`VolumeConfigPanel`/`ChapterConfigPanel`(#15)——`ChapterConfigPanel` 复用 `OutlineEditor` 需改造右面板形态；`VolumeConfigPanel` 计为净新增（见 P0-3）。

### 4.2 复用清单（tech-frontend §2.3）评审

| 复用项 | 结论 |
| --- | --- |
| `StructureTree`（扩展） | 准确。最小扩展点：行内「+ 新建章」、卷节点删除、hover「配置 →」（可借 `actions`）。建议把新建/删除/配置的图标以 props 注入，避免改 `TreeNode` 核心结构。 |
| `ChapterEditor` 重构保留 | 准确。拆法建议：`useChapterData`（load/autosave/三态）+ `ProseEditor`（contenteditable 视图）+ `ChapterEditor`（=ProseEditor + AI 面，PRO）。AI 显隐读 FeatureTier context，不新增 tier prop 层层传。 |
| `useOutline` | 准确，原样复用；但 `VolumeEntry` 类型要按 §7 契约 1 扩 `has_prose/archived`（向后兼容，用 `??` 兜底）。 |
| `OutlineEditor` | 部分准确：章面板可复用（改右面板形态）；卷面板无现成（P0-3）。 |
| `OutlineOverview` | **不消费**（见 2.2-8）：新视图是树+右面板，卡片总览不用于 AdvancedOutlineView；保留文件即可。 |
| `VolumeEditor` | 只复用其保存逻辑（title+summary → `PUT /volumes/{filename}`）作为抽屉/卷面板底座，UI 形态不搬（全页 max-w-3xl 壳不适用右面板）。 |
| `VersionHistory` | 复用，但需包 modal/drawer（现状是带 onBack 的全页组件）。归档回滚是 POST restore（已具备），本交付只保留查看入口即可。 |
| `ArchivePage/ArchiveReader` | 复用。注意：它们是**归档 .md 文件**只读，与工作台「编辑器内只读」是两回事，别混用（2.2-5）。 |
| `RightToolbar/PromptManagementPage/AiReview*/ContrastPreviewModal` | 保留不删，FeatureTier 隐藏/不渲染。`ContrastPreviewModal` 只由 AI 路径触达，免费自然不出现。 |
| `SettingsFormField + 各 *SettingForm + SynopsisCard` | 复用，但要处理 7 项重映射 + synopsis 防重（P2-3）。`ModelSettingForm`(ai-model) 独立配置不入 7 项。 |
| `GateBanner/OnboardingCard/TabProgressButton/useNovelState` | 免费不渲染，PRO 恢复。建议以「PRO 容器」整体挂载，避免 hook 条件调用（P1-2）。 |

### 4.3 删除建议

- `App.tsx` 死子路由（10 条 `Navigate to=".."`）按 §1.1 删，安全。
- **不删**：`NewProject.tsx`（空文件，遗留占位，标注即可）、`LandingPage.tsx`、`ApiKeyConfigPage.tsx` 等现有页面——不在本次范围，精准修改。

---

## 5. 风险补充（tech-frontend R1–R6 之外）

| 编号 | 风险 | 说明 / 对策 |
| --- | --- | --- |
| R7 | **contenteditable 受控回写游标/IME** | 最高优先。无受控策略则每按键跳光标、中文输入损坏。对策见 P0-1（DOM 单向 + composition 守卫 + 粘贴净化）。 |
| R8 | **React 19 StrictMode 双调 effect** | `main.tsx` 已开 `<React.StrictMode>`。LicenseProvider/useChapterData 的挂载 effect 在 dev 双执行（幂等 GET，无害）；但「卸载 flush 未落盘」effect 的 cleanup 必须幂等，避免 dev 下重复 PUT。低危，测试覆盖即可。 |
| R9 | **SSE/流式与 contenteditable 游标耦合** | AI 流式预览/续写依赖 textarea selectionStart；contenteditable 化后需 Range 方案。本交付 AI 隐藏，但 ProseEditor 契约要按 P1-4 预留，避免 PRO 恢复时重做选区层。 |
| R10 | **字数口径分裂** | `/tree` word_count = `len(prose)`（含空白）vs 编辑器 `countChars`（去空白）。同一章节树徽标与底部状态栏数字会打架。§7 契约 1 要求后端对齐；前端不得用树字数顶编辑器字数。 |
| R11 | **`has_prose` 未就位前 WritingTree 不可过滤** | WritingTree 强依赖契约 1 字段。若后端 P1 延后，建议前端降级方案（当前卷/章恒显示 + 本地 prose 判断）先行，避免 UI 步骤整体阻塞。 |
| R12 | **路由是 HashRouter，深链/分享兼容** | `main.tsx` 用 `HashRouter`。tech-frontend §1.1 决策 4 的 `?view=` 同步 URL 需在 hash 内实现（`/#/novel/:id?view=...`），非标准 query；若未来做分享，建议届时评估 `createBrowserRouter` 或显式放弃深链。 |
| R13 | **AI 面隐藏的边界遗漏** | 免费态除 RightToolbar 外，`ChapterEditor` 内部还有 `prompt` tab、`AI 写本章`、`质量检查`（`handleQualityCheck` 是 AI 端点）需一并隐藏；`ArchivePage` 的「编辑」按钮会跳回编辑器（无害）。建议以 FeatureTier 能力位 `ai-generate` 统一覆盖 `ai-write`/`prompt-panel`/`quality-check`。 |

---

## 6. 实施顺序确认与调整

tech-frontend §8 的 1→9 顺序**总体成立**，做两处调整：

1. **插入一条「免费主流程纵切」**：步骤 2（NovelWorkspace + 路由收敛）之后、步骤 4（ProseEditor contenteditable）之前，先以**现有 textarea 版 ChapterEditor + FeatureTier 隐藏 AI** 跑通「建书 → 工作台 → 树 CRUD → 抽屉 → 写正文自动保存 → 归档只读」，把 P0-2/P1-2/P1-3 的交互规则先在非 contenteditable 面上验证，再单独攻 ProseEditor。降低最大风险件的返工面。
2. **标注后端硬依赖**：步骤 3/5/8（WritingTree 过滤、抽屉徽标、树同步）依赖 §7 契约 1（`/tree` 增 `has_prose/archived/word_count` 对齐）与 P1 卷/章元数据入 DB；若后端 P1 未就位，这三步按 R11 降级先行。步骤 1/2/4（两态地基、视图机、编辑器）与后端元数据无耦合，可先行。

调整后顺序建议：
1. `LicenseProvider` + `FeatureTier` + `lib/features.ts`（两态地基）
2. `NovelWorkspace` 四态视图机 + 路由收敛（删死子路由）
3. **免费主流程纵切**：`NovelBar` + `Breadcrumb` + `Workbench` 两栏 + `WritingTree`（降级过滤）+ 现有 textarea `ChapterEditor`（AI 隐藏）+ `BottomStatusBar` 进度 → 验证建书即写→自动保存→归档只读闭环
4. `ProseEditor`（contenteditable + composition 守卫 + 1.5s 防抖 + 字号/行距/专注 + 归档只读 + `selectionContentEditable`）
5. `VolumeConfigDrawer` / `ChapterConfigDrawer`（摘要级，复用现有写端点）
6. `AdvancedSettingsView`（7 项重映射 + 设定 n/7 + 三态徽标；懒挂载，PRO 字段 TierField）
7. `AdvancedOutlineView`（章面板复用 OutlineEditor + 卷面板净新增）
8. archives 视图接线 + `EmptyState` 文案 + 树过滤切真 `has_prose`
9. 对齐 01–04 高保真逐页验收 + E2E 补测

---

## 附：本评审依赖的关键现状代码定位

- 巨石主界面 / isNew→settings：`client/frontend/src/pages/NovelPage.tsx`（L56–83 TABS、L94 默认 tab、L231–237 回设定、L121–125 tier）
- 死子路由：`client/frontend/src/App.tsx`（L36–45）
- 空壳 Layout：`client/frontend/src/pages/NovelLayout.tsx`
- 树基元：`client/frontend/src/components/novel/StructureTree.tsx`
- 编辑器 / 自动保存 / AI 面 / 专注：`client/frontend/src/components/novel/ChapterEditor.tsx`
- 树契约 / saveChapter：`client/frontend/src/hooks/useOutline.ts`（L159 `/tree`、L216 saveChapter）
- 7 项口径：`client/frontend/src/hooks/useOnboarding.ts`（L7）
- 设置表单壳：`client/frontend/src/components/novel/SettingsFormField.tsx`
- 卷摘要保存：`client/frontend/src/components/novel/VolumeEditor.tsx`（L112 `PUT /volumes/{filename}`）
- 归档只读（文件）：`client/frontend/src/components/novel/ArchivePage.tsx` / `ArchiveReader.tsx`
- 选区捕获（textarea）：`client/frontend/src/lib/selection.ts`
- 后端 `/tree`（文件扫描、无 has_prose/archived）：`client/backend/novels/service.py`（`build_project_tree` L147）
- 项目详情字段（无 type/genre）：`client/backend/novels/service.py`（L131–136）
- 卷/章 REST 端点：`client/backend/chapters/router.py`（`PUT /volumes/{filename}` L80、`PUT /chapters/{ref}` L235）
