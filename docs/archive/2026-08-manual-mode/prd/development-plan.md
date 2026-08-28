# C 端改版开发计划 v2（六角色评审终稿 · 执行基准）

> 总架构师终稿 · 2026-08-10（v2 修订）
> 整合来源：`PRD.md` / `ui-design.md` / `backend-design.md` / `feature-matrix.md` / `user-story-map.md` / `manual-mode-review.md` / `pages/01–04` / `prototype.html` / `reviews/{architect,consensus,pm,ui,ux,frontend,backend}.md` / `tech-frontend.md` / `tech-backend.md`
> 定位：从「设计定稿」到「可排迭代」的执行基准；任务可直接排入迭代，按 P0→P1→P2→P3 从高到低。

---

## 1. 评审结论摘要（六角色全部落盘，O2 已闭合）

| 角色 | 结论 | 最重要发现 |
| --- | --- | --- |
| 总架构师 | 方向正确，冲突只在「流程闸门+UI 导航」层 | C1–C6 裁决；G1 双写漂移为最大数据风险 |
| 产品经理 | 部分认可 | **P0：工作台树无「新建卷/章」入口 + 空章不可达**；「目标字数」应免费；归档应可逆 |
| UX 调研员 | 方向对 | **P0：无新建入口 / 空章被过滤 / 主工作台缺高级配置入口**；C3 双轨需打通抽屉→面板 |
| UI 设计师 | 底子扎实 | **S1：高保真用 stone/amber 原生色板 vs 现有 daisyUI token，需建映射表**；02 三栏与 C6 冲突 |
| 前端 | 可行可落地 | **P0：contenteditable 受控回写策略未定（游标/IME）**；`/tree` 是文件扫描且缺 has_prose；多处端点路径与现状不符 |
| 后端架构师 | 可行 | **P0：tier 旁路不绕 update_phase 阶段跃迁 → 免费归档 500**；GET /volumes/POST /chapters 是 breaking change |

**六角色对 C1–C6 全部确认**，未推翻任何一条；修订集中在 17 条新裁决（N1–N17）+ 10 条基线偏差修正（B1–B10），详见 `reviews/consensus.md` v2 §1。Owner 已裁定 O1（免费限 1 本 + 三处显式化）、O6（题材级配置免费可填 + PRO 消费）。

---

## 2. 共识决策速查（C1–C6 复核 + N1–N17 修订）

| 域 | 决策 |
| --- | --- |
| 主界面 | 正文工作台 = 唯一主界面，写作恒默认落点；「高级配置 ▾」（设定/大纲）入口可见可进（N3） |
| 树 | 工作台树常驻「+ 新建卷/章」；**空章「未写」弱化可见，不做硬过滤**；过滤在前端基于 `has_prose`（N1）；hover 配置/重命名/删除（N2） |
| 编辑器 | contenteditable 纯文本模型 + **受控回写策略定死**（DOM→state 单向、IME 守卫、粘贴净化，N8）；1.5s 自动保存；字号/行距/专注；归档只读 + 可逆（N6） |
| 状态栏 | 两栏 + 底部状态栏内嵌进度条（实时字数 + 目标字数可调 + 保存四态含重试）（N5/N13） |
| 设定 | 7 项（题材/简介/世界/风格/反AI味/伏笔/角色），n/7；设置树重映射 ai-model 出/synopsis 入（N12）；题材级配置**免费可填 + PRO 消费**（O6）；免费态「必填」→「建议填写」（N4） |
| 大纲 | 双轨：工作台抽屉（摘要级）+ 高级配置面板（全字段）；抽屉→面板跳转打通（N16）；状态语言四态唯一（N15） |
| 两态 | LicenseProvider/useTier + FeatureTier 能力清单；PRO 阶段 UI 收进「PRO 容器」，免费态顶层不渲染（N14） |
| 门控 | tier 旁路层同时旁路 `update_phase` 阶段跃迁（N9）；免费归档不 500；AI 端点 403 |
| 数据 | volumes/chapters 表入 SQLite；YAML 内容唯一属主；双写补偿式（YAML 先写、DB 后更、懒补、读路径自愈、`ensure_volume_row`）；`GET /volumes` 全量树 + `has_prose` |
| 端点 | **按现状收敛**：复用 `PUT /volumes/{filename}`、`PUT /chapters/{ref}`；breaking change 同 commit 迁移（N11） |
| 视觉 | mockup→daisyUI token 映射表 + 亮/暗双主题验收（N7） |

---

## 3. 前端技术方案要点（修订）

依据 `tech-frontend.md` + `reviews/frontend.md` 修订。以下为与 v1 的差异点，未列者沿用 tech-frontend.md。

### 3.1 路由与视图模型（维持四态，不拆子路由）

```
/novels                  → NovelListPage（改版卡片 + 创建弹窗 + 免费限1本显式化 O1）
/novel/:id               → NovelLayout（AuthGuard + LicenseProvider + 项目壳）
  └─ NovelWorkspace（唯一工作台，内部四态）
     ├─ workbench          （默认落点；写作恒为主界面）
     ├─ advanced-settings  （设定 7 项）
     ├─ advanced-outline   （大纲卷/章面板）
     └─ archives           （归档）
```

- **四态用组件内部视图模型承载**；仅 `Workbench` 常驻挂载（切视图 `hidden` 隐藏，保 prose 脏状态/光标），advanced/archives 首次访问懒挂载、离开卸载（FE P1-1）。
- `NovelPage`（约 1100 行）拆分退役为 `NovelWorkspace` + 四视图；`App.tsx` 死子路由删除；`NovelLayout` 空壳新建项目壳（FE 2.2-7）。
- **忽略 `client/frontend/AGENTS.md`**（过时误导，宣称 Next.js 实为 Vite+React 19，FE 2.2-9）。

### 3.2 contenteditable 编辑器（受控策略定稿，N8）

- **存储/模型层不变**：prose 仍为纯文本字符串（`\n\n` 分段）；章标题由元数据单独渲染。
- **受控回写契约（开工前定稿）**：
  - DOM→state 单向：`ProseEditor` 持 `contentRef`，仅在**载入 / `setPlainText()`** 时写 `innerHTML`；`onInput` 只序列化到 state（供自动保存/字数），**不让 React 因 state 变化重渲染编辑器 DOM**（防每键跳光标）。
  - **IME 守卫**：`onCompositionStart/End` 期间不序列化、不触发防抖保存。
  - **粘贴净化**：`onPaste` 拦截，按白名单（p/br/strong/em）转纯文本/段。
  - 序列化只输出纯文本：段落 `\n\n` join、段内换行拍平；`countChars` 与存储同一份纯文本（杜绝 HTML 写回 YAML）。
- **自动保存**：防抖 3000→1500ms；沿用 saveFnRef/dirty 快照；**保存四态**（自动保存中/已保存/未保存/失败）从现状 4 态对齐 + **失败「重试」按钮**（搬运 `OutlineEditor` 2s auto-clear + error 重试范式，FE 2.2-4/P2-4）；卸载/切章 flush。
- **字号/行距**：15/17/19px、1.8/2.0/2.2，默认 17px/2.0（现状 16px → 统一 17px，UI M7）；CSS 变量作用于容器；偏好 localStorage。
- **专注模式**：提升到 `Workbench` 级；隐藏左树 + 工具条，**保留面包屑栏（UX §4 C4）与底部状态栏**；Esc 退出。
- **归档只读**：`status==='archived'` → contentEditable=false + 顶部 `ArchiveBanner`（含「取消归档，继续编辑」N6）+ 工具条禁用 + 树 📦 同步 + 进度定格。**注：现状归档后 textarea 仍可编辑，编辑器内只读是全新工作**（FE 2.2-5/B6）。
- **选区捕获**：新写 `lib/selectionContentEditable.ts`（基于 `document.getSelection` + Range→纯文本 start/end 偏移），旧 textarea 版 `lib/selection.ts` 保留；`ProseEditor` 暴露 `getPlainText/setPlainText/captureNow`（captureNow 返回纯文本 start/end，供 PRO 恢复复用，FE P1-4）。

### 3.3 状态管理（修订）

- `LicenseProvider/useTier`（缓存 `/auth/verify`，下发 `{tier,isFree,isPro}`）挂 `NovelLayout`。
- `lib/features.ts` 能力清单 + `<TierGate feature>` / `<TierField feature locked>` 统一消费；**能力清单只管功能显隐**，免费限 1 本/试用横幅等运营判定保留直判（FE P2-1）。
- `useChapterData`（load/1.5s 防抖保存/四态/归档态）；`useWorkbench`（project 元信息 + 树 + 选中态 + 四态 view + 归档同步，树与选中态跨视图共享）。
- `useNovelState`（phase-status/gate warnings）：**免费态不消费**——`TabProgressButton/GateBanner/OnboardingCard` 收进「PRO 容器」，免费态顶层不渲染该子树（FE P1-2/N14，杜绝 hook 条件调用）；`fetchPhaseStatus` 由 PRO 容器内部触发。
- `useOutline` 原样复用；`VolumeEntry` 类型扩 `has_prose/archived`（向后兼容 `??` 兜底）。

### 3.4 免费/PRO 两态（修订）

- 能力清单关键位：`tree-crud/prose-edit/version-history/archive/volume-chapter-config/advanced-config-entry/settings-7-items` 免费 ✅；`settings-ai-fields`（核心卖点/目标读者/语言风格/节奏偏好/基调/禁忌/爽点 + **题材级配置按 O6 免费可填、AI 消费归 PRO**）/`outline-advanced-fields`/`ai-generate`/`prompt-panel`/`ai-model` 免费 🔒/隐藏。
- **N3**：`NovelBar` 右侧「高级配置 ▾」（设定/大纲），免费可见可进 + 「可选」标注。
- **N12**：设定 7 项展示口径 = genre/synopsis/world/style/anti-ai/hooks/characters；**ai-model 移出设置树**（独立配置）、**synopsis 新增为树节点**；`SettingsFormField` characters 分支内置 `SynopsisCard` 在 AdvancedSettingsView 中移除（防双份）。
- **N14**：AI 面（RightToolbar、ChapterEditor 内 prompt tab/AI 写本章/质量检查 handleQualityCheck、PromptManagementPage、AiReview*）免费不渲染，代码保留。

### 3.5 实施顺序（含「免费主流程纵切」，FE §6 修订）

1. `LicenseProvider` + `FeatureTier` + `lib/features.ts`（两态地基，无后端耦合）。
2. `NovelWorkspace` 四态视图机 + 路由收敛（删死子路由）。
3. **免费主流程纵切**：`NovelBar` + `Breadcrumb` + `Workbench` 两栏 + `WritingTree`（降级过滤）+ 现有 textarea `ChapterEditor`（AI 隐藏）+ `BottomStatusBar` 进度 → 先验证「建书即写→树 CRUD→抽屉→自动保存→归档只读」闭环。
4. `ProseEditor`（contenteditable + composition 守卫 + 1.5s 防抖 + 字号/行距/专注 + 归档只读 + `selectionContentEditable`）。
5. `VolumeConfigDrawer` / `ChapterConfigDrawer`（摘要级 + 目标字数 + 抽屉→面板跳转）。
6. `AdvancedSettingsView`（7 项重映射 + n/7 + 三态徽标 + 题材配置免费可填）。
7. `AdvancedOutlineView`（章面板复用 OutlineEditor + 卷面板净新增）。
8. archives 视图 + 归档可逆 + `EmptyState` 文案 + 树过滤切真 `has_prose`。
9. 对齐 01–04 高保真逐页验收（token 化、双主题）+ E2E 补测。

> WritingTree 过滤/徽标依赖后端 `/tree` 增 `has_prose/archived`；后端 P1 未就位时按降级方案先行（当前卷/章恒显示 + 本地已载入 prose 判断，FE R11）。

---

## 4. 后端技术方案要点（修订）

依据 `tech-backend.md` + `reviews/backend.md` 修订。以下为差异点，未列者沿用 tech-backend.md。

### 4.1 门控旁路层（N9 修订，核心 P0）

- `workflow/tier.py`：
  - `tier_bypass`：**旁路条件 = 当前无付费权益**（`tier=="none"` **或 过期付费用户 `check_permission` allowed==False**，BE P2-I），非裸 tier 字符串。
  - `tier_or_gate(db, project, gate_fn, *args)`：free 恒过；PRO 走现状 gate。
  - **`tier_phase_transition(project, phase)`：free 下 `update_phase` 跳过 `can_transition` 校验（force 模式），或免费归档/写正文不调 update_phase**——统一收口，杜绝逐点修补（BE P0-1，免费归档 500 根因）。
- 接入点：`create_volume`（gate_settings_complete）、`confirm_chapter`（gate_chapter_ready）、`workflow/transition`（three hard gates）、`archive`（update_phase 旁路）。
- `phase-status` free 追加 `tier_bypass: true`。
- **修复既有 bug**：`gate_archived` 查 `.yaml` 但归档是 `.md` → 改 DB 后从 `chapters.status=='archived'` COUNT（BE B4/P2-G）。
- O3 维持：free 下 current_phase 仍幂等推进（UI 不展示、gate 不拦截）。

### 4.2 归档免费化（修订）

- `POST /chapters/{ref}/archive` 与 `GET /archives*` **移除 `require_ai_access`**。
- `ArchiveService`：写 archives md + DB `status='archived'/archived_at` + YAML status；**AI 摘要降级需捕获 `get_ai_client()` 的 ValueError 与 `client.chat` 异常**（现状无 Key 抛 500，BE B2/D4）；免费/无 Key 用正文首 200 字。
- **P2 级：`unarchive` 端点**（N6，`POST /chapters/{ref}/unarchive` 或同归档端点 `status` 回退）。

### 4.3 卷/章服务与端点（修订）

| # | 端点 | 变更（修订后） |
| --- | --- | --- |
| 1–3 | `POST /api/novels`、`GET /api/novels`、`GET/PATCH/DELETE /api/novels/{id}` | 保持；`novel_to_dict` 补 `type/genre` 展示字段（NovelBar 类型位数据源，FE 2.2-6）或前端从 genre 设定派生 |
| 4 | `GET /api/novels/{id}/volumes` | **DB 查询，返回全量卷+章树元数据（含 `has_prose/archived/outline_status`），不做正文过滤**——过滤在前端（N1/BE P1-E）；**breaking change，同 commit 迁移前端** |
| 5 | `POST /api/novels/{id}/volumes` | 写 YAML → 插 DB 行；**`MAX(volume_no)+1` 并忽略/拒绝 body.vol_num**（BE 3.1/P2-N）；tier_or_gate |
| 6–7 | `GET/PUT /api/novels/{id}/volumes/{ref}` | `{ref}` 容 .yaml；title/summary 双写 DB+YAML，其余 key 只写 YAML；`update_volume` 可 `pop("chapters")` 清派生快照 |
| 8 | `DELETE /api/novels/{id}/volumes/{ref}` | 删 DB（CASCADE 删章）→ 删 YAML/versions/archives；计数维护 |
| 9 | `POST /api/novels/{id}/volumes/{ref}/chapters` | 卷内建章；写 YAML + 插 DB + chapter_count/total_chapters+1；不再写 vol YAML 内嵌列表；**替代旧 POST /chapters，breaking change 同 commit 迁移 test_readiness.py 与前端** |
| 10 | `GET /api/novels/{id}/chapters/{ref}` | YAML 内容 + DB 元数据合并；DB 行缺失则 `ensure_volume_row` + 懒补（**卷行前置**，BE P1-D） |
| 11 | `PUT /api/novels/{id}/chapters/{ref}` | 沿用 `engine.save_chapter` + `refresh_chapter_meta`；**refresh 以 `load_chapter` 重读 YAML 为准，不整行覆盖 payload 缺省字段**（BE P1-C） |
| 12 | `PUT /api/novels/{id}/chapters/{ref}/prose` | 新增：编辑器自动保存专用，body `{prose}`，与 #11 共用 save_prose |
| 13 | `POST /api/novels/{id}/chapters/{ref}/confirm` | tier_or_gate（free 放行）；写 YAML confirmed + DB status/outline_status/confirmed_at；不再写内嵌列表 |
| 14 | `DELETE /api/novels/{id}/chapters/{ref}` | 删 YAML + DB + versions；计数维护 |
| 15 | versions（content/restore/delete） | 保持；**restore 后刷新 word_count/has_prose/status/outline_status/confirmed_at**（BE P2-H） |
| 16 | `POST /api/novels/{id}/chapters/{ref}/archive` | 移除 require_ai_access + update_phase 旁路（N9）+ AI 摘要降级；+ P2 unarchive |
| 17 | `GET /api/novels/{id}/archives` / `GET /{filename}` | 移除 require_ai_access，免费可读 |
| 18 | 设定 7 项读写/确认 | 保持（9 类存储路由不动；展示口径前端收敛） |
| 19 | `GET .../workflow/phase-status` | free 返回 `tier_bypass: true` + phases 全 complete |
| 20 | `POST .../workflow/transition` | gate 走 tier 旁路；update_phase 走 force（N9） |
| 21 | `/api/ai/*`、`/settings/generate`、`/settings/ai/*`、`/prompts*`、`/write*`、`/story*`、`/ai-backfill*` | 保持 require_ai_access（403 占位）；**补挂 `settings/ai_router.generate_field`**（现状漏挂，BE D5） |
| 22 | `write/router._stream_chapter` | **写 YAML 后补 `refresh_chapter_meta`**（N10，P1 落库后 AI 写作字数/状态不陈旧） |

### 4.4 双写一致性（修订）

- YAML 先写（`LocalFileBackend.write_yaml` 已原子 tmp+os.replace）→ DB 后更；**DB 失败降级不 500**：`refresh_chapter_meta` 包 try/except + warning 日志（YAML 已落，DB 行由读路径自愈，BE §5-2）。
- **`refresh_chapter_meta` 以重读 YAML 为准**，只覆盖本次变更字段（BE P1-C）。
- 懒补统一收口 `ensure_volume_row(project_id, volume_no)`（先 upsert 卷行再插章行，BE P1-D）。
- 并发：单用户 + SSE 多流 + 防抖保存；`volumes.chapter_count / projects.total_chapters` 的 `+=1` 与插章同 session 同 commit（避免读改写竞态）。
- **word_count 口径统一**：定义前后端共用字数函数（去空白中文字符数，对齐编辑器 `countChars`），`/tree` 与正文保存同口径（BE P2-J/B5）。

### 4.5 迁移与回填（修订）

- 建表：`models/volume.py`/`models/chapter.py` 注册 → `create_all` 自动建表；`models/project.py` 加 `index_status` 列（none/done）+ `Volume.chapters` relationship `cascade="all, delete-orphan"`（+ ORM FK `ondelete="CASCADE"` 双保险，BE 3.2）。
- 幂等回填 `index_volumes_chapters`：INSERT-if-missing + 只增不删 + `index_status` run-once；**内嵌列表 word_count 不可信，以 `chapters/{ref}.yaml` 为准**（BE B1）；孤儿章建占位卷（title 取内嵌项或「导入卷 N」）；自愈 projects 冗余计数；`import_persist` 调 per-project `reindex_project`。
- **breaking change 清单**（N11）：`GET /volumes` 响应形状、`POST /chapters` 替代、`test_readiness.py` 迁移——必须同 commit。

---

## 5. 数据表设计（最终版）

### 5.1 `volumes`（卷元数据，新增）

| 字段 | 类型 | 约束/默认 | 说明 |
| --- | --- | --- | --- |
| id | String(36) | PK, default uuid4 | 逻辑主键 |
| project_id | String(36) | FK→projects.id, NOT NULL, INDEX | 归属小说（删除是软删，无级联，所有权查询隔离） |
| volume_no | Integer | NOT NULL | 卷序号，创建 `MAX(volume_no)+1`（忽略 body.vol_num） |
| title | String(200) | NOT NULL | 卷名（与 YAML/API title 对齐） |
| summary | Text | NOT NULL default '' | 卷摘要（抽屉免费字段，镜像双写） |
| chapter_count | Integer | NOT NULL default 0 | 冗余计数，创建/删除章维护 |
| created_at / updated_at | DateTime | server_default / onupdate | |
| **UNIQUE(project_id, volume_no)** | | | 同项目卷号唯一 |

> PRO 卷纲全字段（结构模板/核心冲突/情绪走向/信息差/冲突阶梯/场景卡）**不入表**，存 `volumes/vol-N.yaml`。relationship：`Volume.chapters = relationship("Chapter", cascade="all, delete-orphan")`。

### 5.2 `chapters`（章元数据，新增）

| 字段 | 类型 | 约束/默认 | 说明 |
| --- | --- | --- | --- |
| id | String(36) | PK, default uuid4 | 逻辑主键 |
| project_id | String(36) | FK→projects.id, NOT NULL, INDEX | 归属小说 |
| volume_id | String(36) | FK→volumes.id **ON DELETE CASCADE**（ORM ondelete + relationship 双保险）, NOT NULL, INDEX | 归属卷 |
| chapter_no | Integer | NOT NULL | 章序号，卷内 `MAX(chapter_no)+1` |
| ref | String(64) | NOT NULL, **UNIQUE(project_id, ref)** | `vol-N-ch-M`，稳定文件引用 |
| title | String(200) | NOT NULL | 章名（与 YAML title 镜像双写） |
| status | String(20) | NOT NULL default 'outline' | draft/in_progress/outline(存量)/confirmed/archived |
| word_count | Integer | NOT NULL default 0 | 正文字数，保存正文时刷新（**口径 = 去空白中文字符数，前后端共用**） |
| has_prose | Boolean | NOT NULL default False | prose 非空标记（树过滤/归档标记，过滤在前端） |
| outline_status | String(20) | NOT NULL default 'unfilled' | unfilled/in_progress/confirmed（DB 为准） |
| confirmed_at / archived_at | DateTime | NULL | 确认/归档时间 |
| created_at / updated_at | DateTime | server_default / onupdate | |
| **INDEX(project_id, volume_id, status)** | | | 列表/树/归档态查询索引 |

> 不建 `chapter_outlines` 表：章纲内容（outline/memo/emotional_design/segments）与正文 prose 继续整文件存 YAML。
> （`INDEX(project_id, ref)` 单独声明可去，UNIQUE 已含。）

### 5.3 不动 / 新增字段的表

| 表 | 处理 |
| --- | --- |
| projects | 不改结构；`total_volumes/chapters/archives` 降级为冗余计数由服务维护、回填自愈（可选实时 COUNT）；新增 `index_status` 列（none/done） |
| project_settings | 不动，9 类 key 继续 KV（展示口径 7 项前端收敛） |
| api_configs / genres / users / token_log / events / audit_log | 不动 |
| 六阶段就绪度 | 不落表，`workflow/gates.get_phase_status` 实时计算 |

---

## 6. 前端组件选择（修订清单）

### 6.1 新建组件（`src/components/novel/…`）

| # | 组件 | 职责 | 备注（修订） |
| --- | --- | --- | --- |
| 1 | `license/LicenseProvider.tsx` + `useTier` | tier 单一数据源 | React Context |
| 2 | `license/FeatureTier.tsx` + `lib/features.ts` | 能力清单 + `<TierGate>/<TierField>` | 只管功能显隐，运营判定直判 |
| 3 | `NovelWorkspace.tsx` | **四态视图机（v2 显式列入）** | workbench/advanced-settings/advanced-outline/archives；Workbench 常驻 + hidden 切换 |
| 4 | `NovelBar.tsx` | 小说栏：书名改名 + 类型 + **高级配置 ▾（N3）** + 归档 + 免费提示 | 类型数据源见后端契约 |
| 5 | `Breadcrumb.tsx` | 面包屑（h-9，仅工作台；**可点击跳转 N17**；专注模式保留） | |
| 6 | `Workbench.tsx` | 两栏容器（左 WritingTree + 右编辑器 + BottomStatusBar）；focusMode 状态 | |
| 7 | `WritingTree.tsx` | 包装 StructureTree：**+新建卷/章、空章「未写」弱化、hover 配置/重命名/删除（N1/N2）**、字数/归档徽标 | 过滤在前端基于 has_prose |
| 8 | `ProseEditor.tsx` | **contenteditable（v2 显式列入，最大新件）**：受控回写 + IME 守卫 + 粘贴净化 + 字号行距 + 专注 + 归档只读 | 暴露 getPlainText/setPlainText/captureNow |
| 9 | `lib/selectionContentEditable.ts` | contenteditable 选区捕获（纯文本 start/end） | 新增，textarea 版保留 |
| 10 | `VolumeConfigDrawer.tsx` / `ChapterConfigDrawer.tsx` | 工作台抽屉：卷名+摘要 / 章名+摘要+**目标字数（N5）** +「去写正文」+「完整字段 →」跳转（N16） | |
| 11 | `EditorToolbar.tsx` | 字号/行距分段 + 专注 + 版本历史 + 归档本章 | `join` + `btn` |
| 12 | `BottomStatusBar.tsx` | 实时字数 + 保存四态（含重试）+ 内嵌进度条（当前/目标 + 字数同排） | `progress progress-primary h-1.5` |
| 13 | `ArchiveBanner.tsx` | 归档只读提示条 + 「取消归档，继续编辑」（N6） | `alert alert-warning` |
| 14 | `AdvancedSettingsView.tsx` | 设定 7 项 + n/7 进度 + 三态徽标 + 题材配置免费可填（O6）+ PRO 字段 TierField | 懒挂载；7 项重映射（N12） |
| 15 | `AdvancedOutlineView.tsx` | 左卷/章树 + 右上下文面板（全字段）；缺字段提示 + 批量确认 | 状态语言四态（N15） |
| 16 | `VolumeConfigPanel.tsx` | 卷纲全字段（结构模板/冲突阶梯/信息差/场景卡） | **净新增表单**（FE P0-3，无现成复用） |
| 17 | `ChapterConfigPanel.tsx` | 章纲全字段（方向/key_points/情绪/钩子/段落/目标字数） | 复用 OutlineEditor 改右面板形态 |
| 18 | `EmptyState.tsx`（改造） | 建书即写空态：添加卷/章 + 高级配置次级链接 +「先写正文」 | 去设定门控 |

> v1 的 `SettingsProgressBar`/`SettingNodeBadge` **合并进 AdvancedSettingsView 内部**（或仅抽 `SettingNodeBadge`），不建两个独立组件（FE §4.1）。

### 6.2 复用现有组件

| 现有组件 | 新角色 | 修订备注 |
| --- | --- | --- |
| `StructureTree` | 树基元 | 扩展行内新建/卷节点删除/hover 配置；图标以 props 注入不改核心结构 |
| `ChapterEditor` | 重构保留 | 拆 `useChapterData` + `ProseEditor`；AI 面挂 FeatureTier 隐藏 |
| `OutlineEditor` | 章面板 | 需改右面板形态（去 onBack/全页壳） |
| `OutlineOverview` | **不消费**（FE 2.2-8） | 保留文件，新视图默认不用 |
| `VolumeEditor` | 只复用保存逻辑 | title+summary → `PUT /volumes/{filename}` |
| `SettingsFormField` + 各 `*SettingForm` | 设定表单 | 7 项重映射 + synopsis 防重（N12） |
| `VersionHistory` | 版本历史 | 包 modal/drawer；本交付只留查看入口 |
| `ArchivePage/ArchiveReader` | archives 视图 | 与「编辑器内只读」是两回事，别混用 |
| `CreateProjectModal/DeleteConfirmModal/RenameModal` | CRUD | 创建弹窗加 O1 显式化 |
| `GateBanner/OnboardingCard/TabProgressButton` | PRO 容器 | 免费不渲染，PRO 恢复（N14） |
| `RightToolbar/PromptManagementPage/AiReview*` | AI 面 | 保留不删，FeatureTier 隐藏 |
| `shared/StatusBadge` | 三态徽标 | 四态唯一化（N15） |

---

## 7. 开发任务列表（从高到低）

> 优先级对齐分期：P0 免费基础 + 决策收敛 → P1 数据底座 + breaking change → P2 UI&UX 改版 → P3 PRO 范围外留接口。`依赖` 引用任务标题。

### P0 — 决策收敛 + 免费基础能力 + 门控旁路（先交付「建书即写」核心价值）

| 优先级 | 任务 | 涉及 | 依赖 |
| --- | --- | --- | --- |
| P0-1 | **PRD v1.1 收敛（C1–C6 复核 + N1–N17 修订 + O1/O6 裁决落地）**：修订 PRD §2/§5.1/§5.2/§5.4/§8（空章可见 N1、树 CRUD N2、高级配置入口 N3、目标字数免费 N5、必填→建议 N4、限1本显式化 O1、题材配置免费可填 O6）；修 03-settings 6/7 进度 bug（画7项/JS按7/显示n/7）；**contenteditable 受控策略定稿（N8）** | 文档（前端/后端无代码） | — |
| P0-2 | **tier 感知门控旁路层（后端 workflow/tier.py）**：`tier_bypass`（tier=none **或 过期付费**，BE P2-I）；`tier_or_gate`；**`tier_phase_transition` 旁路 update_phase 阶段跃迁（N9）**；接入 create_volume/confirm_chapter/workflow/transition；phase-status free 返 `tier_bypass:true`；修 gate_archived `.yaml/.md` bug（B4） | 后端（workflow/tier.py + gates/engine/router） | — |
| P0-3 | **归档免费化（后端 archive/service）**：archive/GET archives 移除 require_ai_access；AI 摘要降级（捕获 ValueError/chat 异常，正文首 200 字）；归档走 N9 不 500 | 后端（archive/service + router） | P0-2 |
| P0-4 | **两态地基（前端 LicenseProvider + useTier + lib/features.ts + FeatureTier）** | 前端 | — |
| P0-5 | **新书默认落点正文工作台 + PRO 容器（前端）**：NovelPage isNew→settings 改默认 workbench；TabProgressButton/GateBanner/OnboardingCard 收进 PRO 容器（N14） | 前端（NovelPage/NovelWorkspace 雏形） | P0-4 |
| P0-6 | **AI 面免费隐藏 + AI 端点 403 补全**：前端 FeatureTier 隐藏（含 ChapterEditor 内 prompt tab/AI 写本章/质量检查）；后端补挂 settings/ai_router.generate_field require_ai_access | 前端 + 后端（settings/ai_router） | P0-4 |
| P0-7 | **免费主流程纵切（前端）**：NovelWorkspace 四态视图机 + 路由收敛；NovelBar（书名改名/类型/高级配置▾/归档/免费提示）；Workbench 两栏 + WritingTree（新建卷/章、空章弱化、hover 配置/重命名/删除、降级过滤）；现有 textarea ChapterEditor（AI 隐藏）+ BottomStatusBar 进度（目标字数可调 N5）；**验证建书即写→树CRUD→抽屉→自动保存→归档只读闭环（N1 显式验收）** | 前端（NovelWorkspace/NovelBar/Workbench/WritingTree/BottomStatusBar） | P0-4、P0-5、P0-2、P0-3 |
| P0-8 | **免费主流程闭环验证 + 后端联调**：验收对齐 PRD §8 + N1（新建章节即达编辑器）；全程无 AI 字段/提示词/阶段催促 UI；免费直呼 AI 端点 403；免费归档不 500 | 前端 + 后端 | P0-2~P0-7 |

### P1 — 数据底座（卷/章元数据入 SQLite，树/进度/归档的查询底座）

| 优先级 | 任务 | 涉及 | 依赖 |
| --- | --- | --- | --- |
| P1-1 | **volumes/chapters 数据表 + 模型 + 建表**：models/volume.py、chapter.py 注册 → create_all；project.py 加 `index_status` 列 + Volume.chapters relationship（cascade + ondelete 双保险）；可选补 C 端 Alembic | 后端（models + main.py） | — |
| P1-2 | **幂等回填 index_volumes_chapters + lifespan 挂载**：INSERT-if-missing + 只增不删 + run-once；以 chapters/{ref}.yaml 为准（内嵌 word_count 不可信 B1）；孤儿章占位卷；自愈冗余计数；import_persist 调 reindex_project | 后端（filesystem/index_volumes_chapters.py + novels/router） | P1-1 |
| P1-3 | **VolumeService + VolumeRepository + 卷端点改造**：list_volumes 改 DB（免 N+1，返回全量+has_prose）；create MAX+1 忽略 vol_num；update title/summary 双写 + 其余 key 只写 YAML + pop chapters；delete 级联删章 + 删文件 + 计数；{ref} 容 .yaml | 后端（volumes/* + repositories/volume_repo.py） | P1-1、P1-2 |
| P1-4 | **ChapterService + ChapterRepository + 章端点改造（双写核心）**：create_chapter（MAX+1、不写内嵌列表）；save_chapter/save_prose（engine.save_chapter + refresh 以 YAML 为准）；PUT .../prose 新增；confirm（tier_or_gate + DB 状态写）；delete 级联清理 + 计数；versions restore 后刷 status/outline_status/confirmed_at；`ensure_volume_row` 懒补前置 | 后端（chapters/* + repositories/chapter_repo.py） | P1-1、P1-2、P0-2 |
| P1-5 | **GET /volumes 全量树 + build_project_tree 改 DB + POST /chapters 替代 + breaking change 迁移**：树数据源切 DB（返回结构含 has_prose/archived）；前端 useOutline 零改动；**同 commit 迁移前端 NovelPage.loadVolumes 与 test_readiness.py**（N11/BE P1-A/P1-B） | 后端（novels/service + volumes/router + tests） | P1-3、P1-4 |
| P1-6 | **write/_stream_chapter 补 refresh_chapter_meta（N10）+ novel_to_dict 补 type/genre 字段** | 后端（write/router + novels/service） | P1-4 |
| P1-7 | **后端测试套件**：test_volume_chapter_index（回填幂等/孤儿占位/import/run-once）、test_dual_write（DB 元数据正确/YAML 内容准/refresh 以 YAML 为准）、test_volume_chapter_crud（双写一致性/章号自增/级联删）、test_free_bypass（tier=none 全放行 + tier_bypass + **归档不 500 N9**）、test_archive_free（无 Key 归档/免费可读/unarchive N6）、test_tree_db（DB 树 + has_prose）、test_readiness 迁移 | 后端（tests/*） | P1-3~P1-6 |

### P2 — UI&UX 改版（正文工作台收敛 + 高保真四页落地）

| 优先级 | 任务 | 涉及 | 依赖 |
| --- | --- | --- | --- |
| P2-1 | **ProseEditor（contenteditable 受控 + 1.5s 自动保存 + 字号行距 + 专注模式 + 归档只读）**：N8 策略落地（DOM→state 单向/IME 守卫/粘贴净化）；保存四态含重试；17px/2.0 默认 + token；专注模式提升 Workbench 级（保留面包屑与底部状态栏，Esc 退出）；归档 contentEditable=false + ArchiveBanner；`lib/selectionContentEditable.ts` | 前端（ProseEditor + useChapterData） | P0-1（策略）、P0-7（纵切闭环）、P1-4 |
| P2-2 | **EditorToolbar + BottomStatusBar（保存四态 + 内嵌进度条）**：从 ChapterEditor 抽取；进度条当前/目标（目标字数可调 N5）+ 字数 + 保存态同排 | 前端 | P2-1 |
| P2-3 | **VolumeConfigDrawer / ChapterConfigDrawer**：抽屉互斥、事件不冒泡；卷名+摘要 / 章名+摘要+目标字数；「去写正文」；「完整字段 →」跳高级大纲并定位节点（N16）；复用现有写端点 | 前端 | P2-1、P1-4 |
| P2-4 | **AdvancedSettingsView（设定 7 项 + n/7 + 三态徽标 + tier 显隐）**：7 项重映射（ai-model 出/synopsis 入，N12）；题材级配置免费可填（O6）；PRO 字段 TierField 🔒；免费态「建议填写」（N4）；懒挂载 | 前端 | P0-4、P0-7、P2-1 |
| P2-5 | **AdvancedOutlineView（卷/章全字段面板）**：卷面板净新增（VolumeConfigPanel）；章面板复用 OutlineEditor 改右面板；缺字段提示+跳转高亮；批量确认；状态语言四态（N15）；与抽屉共用 chapterData 缓存（N16） | 前端 | P0-7、P1-4、P2-3 |
| P2-6 | **archives 视图 + 归档可逆（N6）+ EmptyState 文案**：接线 ArchivePage/ArchiveReader；unarchive 入口（后端 P1-7 已备）；EmptyState 建书即写空态 | 前端 | P0-7、P1-7 |
| P2-7 | **mockup→token 双主题收敛 + 状态语言全站统一（N7/N15）**：token 映射落地（amber→primary 等）、亮/暗双主题验收；四态 badge 胶囊；对比度 WCAG AA（功能文本 ≥4.5:1）；树/抽屉 a11y（focus-within 可发现、Esc、焦点管理） | 前端（全局样式 + 组件基元） | P2-1~P2-6 |
| P2-8 | **01–04 高保真四页对齐验收 + E2E 补测**：01-list（O1 显式化）/02-writing（两栏 C6 + 底部进度条 N13）/03-settings（7 项无 bug）/04-outline（免费态字段显隐蓝本）逐页对照并接真数据；E2E 免费主流程（建书即写→树 CRUD→抽屉→写作自动保存→归档只读→树/进度同步；N1 新建章节即达编辑器；全程无 AI 字段与提示词） | 前端（逐页验收 + E2E）+ 后端（联调） | P2-1~P2-7 |

### P3 — PRO 解锁（范围外，只留接口）

| 优先级 | 任务 | 涉及 | 依赖 |
| --- | --- | --- | --- |
| P3-1 | **PRO 解锁逻辑占位**：AI 生成正文（流式/API/计费）、提示词面板 UI、AI 字段 PRO 解锁——本次只留 tier 开关 + 能力清单 + 端点门控占位；P3 再把 require_ai_access 语义从「有无 API Key」改为「tier 是否 PRO」，并在 FeatureTier 门控下恢复既有 AI 代码路径 | 前端 + 后端 | P0–P2 全部 |

---

## 8. 关键验收锚点（迭代排期对照）

| 期 | 可验收结果 |
| --- | --- |
| P0 | 免费建书 → 直达正文工作台可写；**树「+ 新建卷/章」→ 新建「第一章」即达编辑器**（N1）；树 CRUD + 抽屉（含目标字数）闭环；自动保存/字数/归档只读可用；**主工作台可见「高级配置 ▾」**（N3）；全程无阶段催促 UI、无 AI 字段、无提示词；免费直呼 AI 端点 403；免费归档不 500（N9） |
| P1 | 卷/章元数据入 DB（volumes/chapters 表 + 回填幂等）；列表/树/字数/进度/归档态走 DB；`GET /volumes` 全量 + has_prose；YAML 仍为内容唯一属主；breaking change 同 commit 迁移完成；后端测试套件通过 |
| P2 | 正文工作台四层栏 + 两栏 + 底部进度条落地；contenteditable 编辑无游标跳/IME 损坏（N8）；高级配置独立视图（设定 7 项 + 大纲卷/章面板）从入口进入 + 返回正文；状态语言四态唯一（N15）；token 化双主题验收通过（N7）；01–04 高保真四页对齐并接真数据；E2E 免费主流程通过 |
| P3 | PRO 解锁接口占位（tier 开关 + 能力清单 + 端点门控），不实现 AI 生成/提示词面板 UI |

---

## 9. 引用索引

- 六角色评审：`docs/prd/reviews/{architect,consensus,pm,ui,ux,frontend,backend}.md`
- 技术方案初稿（v2 修订见本文 §3/§4）：`docs/prd/tech-frontend.md`、`tech-backend.md`
- 主文档与高保真：`docs/prd/PRD.md`、`ui-design.md`、`backend-design.md`、`feature-matrix.md`、`user-story-map.md`、`manual-mode-review.md`、`pages/01–04`、`prototype.html`
