# 共识裁决 v2：爱小说 C 端大改版（六角色评审补齐 + 修订裁决）

> 协调人：共识协调 agent · 2026-08-10
> 裁决规则：多数同意即通过 + 总架构师意见一票加权；owner 对纯产品/商业口径一票定案（O1/O6）。
> 版本说明：v1 以 architect.md 单评审推定；本 v2 为**六角色评审全部落盘后**的终版共识，闭合 v1 O2 缺口，并纳入五份新评审（pm/ui/ux/frontend/backend）的修订裁决 N1–N15。

---

## 0. 评审文件可用性（O2 已闭合）

六角色评审现已全部落盘于 `docs/prd/reviews/`：

| 角色 | 文件 | 总体结论 |
| --- | --- | --- |
| 产品经理 | `pm.md` | 部分认可 · 2 处 P0 闭环缺口（工作台树无新建卷/章、缺重命名删除） |
| UX 调研员 | `ux.md` | 方向对 · 3 处 P0 断链（无新建入口、空章被过滤、无高级配置入口） |
| UI 设计师 | `ui.md` | 底子扎实 · 色板 token 断层 S1 等需开发前收敛 |
| 前端 | `frontend.md` | 可行 · contenteditable 受控回写等 3 处 P0、多处现状基线偏差 |
| 后端架构师 | `backend.md` | 可行 · update_phase 非法跃迁 500 等 P0、3 处基线偏差 + 1 既有 bug |
| 总架构师 | `architect.md` | C1–C6 已裁决（本 v2 逐条复核确认） |

**六角色对 C1–C6 六条裁决全部确认**，无推翻；修订集中于「闭环断链」「技术落地」「基线偏差」三层，见 §2 新裁决 N1–N15。

---

## 1. 裁决总表（v2）

### 1.1 C1–C6（复核确认，六角色一致）

| # | 裁决 | 复核 |
| --- | --- | --- |
| C1 | 设定入口免费可见但折叠「高级配置 · 可选」；免费只渲染人工字段，PRO 字段隐藏/🔒 | 全部确认。落地缺入口（N3）；题材级配置按 O6 改为免费可填（owner 裁定） |
| C2 | 设定统一 7 项（题材/简介/世界/风格/反AI味/伏笔/角色），进度 n/7；ai-model 移出进度 | 全部确认。设置树需重映射（N12）；03 修 6/7 bug |
| C3 | 大纲双轨：工作台点树节点 = 轻量抽屉；高级配置大纲视图 = 左树+右面板 | 全部确认。需打通抽屉→全字段路径（N16）、状态语言分离（N15） |
| C4 | 面包屑保留，仅正文工作台 | 全部确认。面包屑需可点击（N17）；专注模式保留面包屑 |
| C5 | 正文工作台唯一主界面、写作恒默认落点；设定/大纲入口按钮→独立视图；提示词 tab 移除 | 全部确认。落地缺入口（N3）；PRO 阶段 UI 收进 PRO 容器（N14） |
| C6 | 两栏 + 底部状态栏内嵌进度条，不设常驻右栏 | 全部确认。02-writing 按 C6 收敛（N13）；给出具体视觉形态（UI §4.1） |

### 1.2 新增修订裁决（N1–N17，本轮评审产物）

| # | 裁决 | 来源（评审证据） |
| --- | --- | --- |
| N1 | **工作台树常驻「+ 新建卷」「+ 新建章」入口；正文树显示全部章节、空章弱化为「未写」态，不做硬过滤**；若保留过滤则规则=`has_prose ∥ isSelected ∥ 本会话新建`，且由**前端**基于后端全量 `has_prose` 做。修复 PRD §5.2「只显示有正文章节」与 §8 验收#2 的自相矛盾 | PM P0-1 / UX P0-1+P0-2 / FE P0-2 / BE P1-E（四角色一致） |
| N2 | 树节点 hover 提供 重命名/删除（免费），工作台树与大纲视图同一交互底座 | PM P0-2 / UX P2-7 / UI M1、L2 |
| N3 | **主工作台小说栏必须有「高级配置 ▾」（设定/大纲）入口**，免费可见可进 + 「可选」标注；修复 02-writing 无设定/大纲入口的断链 | UX P0-3 / UI §4.2 C1 / PM O2 |
| N4 | 免费态「必填」→「建议填写」；「必填」语义仅保留 PRO「AI 生成前置条件」 | PM P1-3 / UX P1-5（一致） |
| N5 | **「目标字数」划入免费章抽屉**（章名+摘要+目标字数），底部进度条目标可调；PRO 增值 = AI 按目标规划 | PM P1-2 |
| N6 | 归档可逆：只读提示条加「取消归档，继续编辑」轻量入口（P2 级，需 unarchive 端点） | PM P1-4 |
| N7 | **mockup→daisyUI token 映射表**（amber-600→primary、stone-100→base-100、emerald→success、stone-300→base-content/30 等），亮/暗双主题验收；所有组件落到 token，不引入新色板 | UI S1（开发前必做） |
| N8 | **contenteditable 受控回写策略定死**：DOM→state 单向、state→DOM 仅外部触发（载入/`setPlainText`）；IME composition 守卫（start/end 间不序列化不保存）；粘贴按白名单净化；序列化只输出纯文本 | FE P0-1（开工前定稿，否则最大新件返工） |
| N9 | **tier 旁路必须同时旁路 `update_phase` 阶段跃迁校验**：free 下 `update_phase` 跳过 `can_transition`（force 模式）或免费归档不调 update_phase；统一收口 `workflow/tier.py`，杜绝逐点修补 | BE P0-1（免费归档 500 根因） |
| N10 | AI 流式写正文（`write/router._stream_chapter`）完成写入后补一次 `refresh_chapter_meta`，P1 落库后 PRO AI 写作字数/状态不陈旧 | BE P0-2（P1/P3 边界处理） |
| N11 | **端点契约按现状收敛**：复用现有 `PUT /volumes/{filename}`、`PUT /chapters/{ref}`，不新增重复端点；`GET /volumes` 改 DB 树形、`POST /chapters` 替代均为 **breaking change，同 commit 迁移前端与 test_readiness.py** | FE 2.2-3 / BE P1-A+P1-B |
| N12 | 设置树 7 项重映射：**ai-model 移出树、synopsis 新增为树节点**；`SettingsFormField` characters 分支内置 `SynopsisCard` 需防重复渲染 | FE 2.2-2（现状 SETTINGS_TREE_ITEMS 7 项含 ai-model、无 synopsis） |
| N13 | 02-writing 按 C6 收敛为**两栏 + 底部进度条**（删右栏，进度并入底部状态栏）；高保真标注「待按 C6 收敛」 | PM P1-1 / UX P2-5 / UI S2（一致） |
| N14 | **PRO 阶段 UI（TabProgressButton/GateBanner/OnboardingCard）收进「PRO 容器」，免费态顶层不渲染该子树**——杜绝 hook 条件调用、天然满足「不散落 if(tier)」 | FE P1-2 |
| N15 | **状态语言全站唯一四态**：未填 ○ / 进行中 ● / 已确认 ✓ / 已归档 📦，统一 `badge` 胶囊（ghost/warning/success/neutral）；写作状态（字数+归档）与章纲状态（outline_status）分离，不同屏 | UI H2 / UX P1-4 |
| N16 | 双轨打通：抽屉底部「查看/编辑完整字段 →」跳高级配置大纲视图并定位该节点；双轨共用 `useWorkbench` 持有的同一 chapterData 缓存，打开前 flush/refetch，防 merge 覆盖 | UX P1-1 / FE P1-3 |
| N17 | 面包屑卷/章段可点击跳转（专注模式/树收起时为可导航锚点）；专注模式保留面包屑栏 | PM P2-1 / UX §4 C4 / UI L3 |

### 1.3 基线偏差修正（评审实证，非裁决）

| 编号 | 修正 | 来源 |
| --- | --- | --- |
| B1 | `build_project_tree` 的 word_count 并非恒 0：import 项目内嵌列表含 prose 会算出真字数；回填/去重时内嵌列表 word_count 不可信，以 `chapters/{ref}.yaml` 为准 | BE 2.2-B1 |
| B2 | 无 Key 归档失败码是 500 非 503 | BE 2.2-B2 |
| B3 | 「9 类 key」指存储路由；`VALID_TYPES` 实为 8 类（7+ai-model） | BE 2.2-B3 |
| B4 | 既有 bug：`gate_archived` 查 `.yaml` 但归档文件是 `.md` → archive 阶段状态永远 in_progress；改 DB 后从 `chapters.status=='archived'` COUNT | BE 2.2-B4 / P2-G |
| B5 | 现状树字数口径 `len(prose)`（含空白）与编辑器 `countChars`（去空白）不一致，`/tree` 需对齐口径 | FE 2.2-1 / BE P2-J |
| B6 | 归档后编辑器只读在现状不存在（textarea 仍可编辑）——是全新工作，非「已具备」 | FE 2.2-5 |
| B7 | `NovelLayout` 是空壳（仅 AuthGuard），项目壳 + LicenseProvider 全新建 | FE 2.2-7 |
| B8 | `client/frontend/AGENTS.md` 过时误导（宣称 Next.js，实为 Vite+React 19），实施时忽略 | FE 2.2-9 |
| B9 | `create_volume` 接受 body.vol_num 任意卷号，入表后撞 UNIQUE 约束；改 `MAX(volume_no)+1` 并兼容期忽略 body.vol_num | BE 3.1 / P2-N |
| B10 | 读路径自愈缺卷行前置：懒补前先 upsert `Volume` 行，统一收口 `ensure_volume_row` | BE P1-D |

---

## 2. 开放问题裁决（v1 的 O1–O6 终局）

| # | v1 问题 | 终局 |
| --- | --- | --- |
| O1 | 免费限 1 本口径 | **owner 裁定：保留限 1 本 + 三处显式化**（PM 立场）。定位措辞改「免费 = 完整人工写作能力（限 1 部作品）」；创建弹窗保留提示并升级为转化锚点「升级 PRO 解锁多本」；列表满额显示「已用 1/1，升级解锁更多」而非隐藏入口。后端 `require_project_limit` 现状不动 |
| O2 | 其余 5 份角色评审缺失 | **已闭合**：pm/ui/ux/frontend/backend 五份评审已落盘，本 v2 以六角色评审为基 |
| O3 | free 下 current_phase 是否随操作推进 | **维持 tech-backend §5.2 决策**：free 下 current_phase 仍幂等推进，但经 N9 统一旁路 `can_transition` 校验（UI 不展示、gate 不拦截） |
| O4 | 免费模式章纲/章节状态显隐 | **按 N1/N15**：工作台树显示写作状态（字数+归档），空章「未写」弱化；章纲状态（outline_status）仅在大纲视图展示；树过滤在前端 |
| O5 | 03-settings 进度 bug 验收口径 | **随 C2 收敛 7 项一并修复**：画 7 项、JS 按 7 计算、显示 n/7，条宽与标签同口径（UI H1）；加一条可验证验收 |
| O6 | 题材级配置免费可见性 | **owner 裁定：题材级配置免费可填 + PRO 消费**（PM 立场）。免费可填全部题材配置文本（基调/禁忌/爽点/节奏/弧线），PRO 增值 = AI 读取消费这些约束；替换 architect C1 的「整区 PRO」子项 |

---

## 3. 本次锁定范围（v2，含 N1–N17 修订）

**锁定（本次交付）——免费基础能力 + 页面 UI&UX + 数据底座**：
- 免费基础能力：建书即写（默认落点正文工作台）、**工作台树「+ 新建卷/章」+ hover 配置/重命名/删除（N1/N2）**、空章「未写」弱化可见（N1）、卷/章轻量配置抽屉（卷名+摘要 / 章名+摘要+**目标字数**，N5）、正文编辑器（自动保存 1.5s/实时字数/字号行距/专注模式/归档只读）、底部状态栏 + 进度条、版本历史、**归档只读 + 可逆（N6）**、面包屑可点击（N17）、**主工作台「高级配置 ▾」入口（N3）**、免费/PRO 字段按 tier 显隐（FeatureTier）、免费 tier 门控旁路（含 **update_phase 旁路 N9**、阶段 UI 不渲染 N14）、AI 面免费隐藏 + 端点 403。
- 页面 UI&UX：正文工作台四层栏 + 两栏落地（N13）、高级配置独立视图（设定 7 项 + 大纲卷/章面板，入口进入 + 返回正文）、**状态语言四态统一（N15）**、**mockup→token 双主题验收（N7）**、01–04 高保真四页实现并接真数据。
- 数据底座：volumes/chapters 表 + 幂等回填 + 双写（YAML 先写、DB 后更、懒补、读路径自愈、`ensure_volume_row`）、`GET /volumes` 返回全量树 + `has_prose`、端点按现状收敛 + breaking change 同 commit 迁移（N11）、`write/_stream_chapter` 补刷新（N10）。

**范围外（本次不做，后续迭代）**：AI 生成正文（流式/API/计费）、PRO 付费解锁逻辑（只留 tier 开关 + 能力清单 + 端点门控占位）、提示词面板 UI、导入导出、多端同步。（免费限 1 本口径按 O1 只改文案显式化，不改机制。）

---

## 4. 验收锚点（对齐修订后 PRD §8 + N1）

| 期 | 可验收结果 |
| --- | --- |
| P0 | 免费建书 → 直达正文工作台；**树「+ 新建卷/章」→ 新建「第一章」即达编辑器可写**（N1 显式验收）；树 CRUD + 抽屉（含目标字数）闭环；自动保存/字数/归档只读可用；**主工作台可见「高级配置 ▾」**（N3）；全程无阶段催促 UI、无 AI 字段、无提示词；免费直呼 AI 端点 403；免费归档不 500（N9） |
| P1 | 卷/章元数据入 DB（volumes/chapters 表 + 回填幂等）；列表/树/字数/进度/归档态走 DB；`GET /volumes` 全量 + `has_prose`；YAML 仍为内容唯一属主；后端测试套件通过（含 breaking change 迁移） |
| P2 | 正文工作台四层栏 + 两栏 + 底部进度条落地；高级配置独立视图（设定 7 项 + 大纲卷/章面板）从入口进入 + 返回正文；contenteditable 编辑无游标跳/IME 损坏（N8）；状态语言四态唯一（N15）；01–04 高保真四页对齐（token 化、双主题）并接真数据；E2E 免费主流程通过 |
| P3 | PRO 解锁接口占位（tier 开关 + 能力清单 + 端点门控），不实现 AI 生成/提示词面板 UI |

---

## 5. 引用索引

- 六角色评审：`docs/prd/reviews/{pm,ui,ux,frontend,backend,architect}.md`
- 主文档与高保真：`docs/prd/PRD.md`、`ui-design.md`、`backend-design.md`、`feature-matrix.md`、`user-story-map.md`、`manual-mode-review.md`、`pages/01–04`、`prototype.html`
- 技术方案与执行计划：`tech-frontend.md`、`tech-backend.md`、`development-plan.md`
