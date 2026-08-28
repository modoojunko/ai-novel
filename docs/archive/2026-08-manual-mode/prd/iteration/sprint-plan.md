# Sprint 1 排期计划：免费主流程 MVP（P0 免费基础能力先行 + P1 数据底座）

> Sprint Prioritizer · 2026-08-10
> 依据：`development-plan.md` v2（§7 任务列表 / §8 验收锚点）、`reviews/consensus.md` v2（§3 锁定范围 / §4 验收锚点）、`PRD.md` v1.1、`tech-frontend.md` / `tech-backend.md`、现状代码 `client/`
> 迭代目标（一句）：**免费 = 完整人工写作能力的最小闭环**——建书即写 → 树 CRUD → 抽屉 → 自动保存 → 归档只读，全程无阶段催促 UI、无 AI 字段、无提示词；免费直呼 AI 端点 403、免费归档不 500。

---

## 1. 范围决策（P0 免费基础能力先行）

### 1.1 纳入本次迭代（Commit）

| 分组 | 任务 | 承诺级别 | 理由 |
| --- | --- | --- | --- |
| P0 全量 | P0-1 ~ P0-8 | **硬承诺（MVP 截止线）** | PRD §3.1 免费主流程 + consensus §4 P0 锚点；这是本次迭代必须交付的最小闭环 |
| P1 数据底座 | P1-1 ~ P1-7 | **次优先（锁定范围）** | consensus §3 明确把「卷/章元数据入 DB」锁定在本次交付；是 N1 空章弱化、字数/归档徽标、进度条的**真实数据源**，也是 P0-7 完整验收的前置 |

**纳入 P1 的关键取舍**：P0-7 文档允许降级树（FE R11：当前卷/章恒显示 + 本地已载入 prose 判断），但那是停靠方案。P0-7 与 P1-5 共享同一段前端 `loadVolumes` 代码，而 P1-5 的 `GET /volumes` 全量树是 breaking change（N11）——**先落 P1-5 再写 P0-7，前端只需按最终契约写一次**，避免「先按旧形状写、再同 commit 返工」的双倍成本。因此 P0+P1 同迭代，P0 是硬线，P1 是闭环的完整性兜底。

### 1.2 推迟 / 裁剪（Defer / Cut）

| 任务 | 处置 | 理由 |
| --- | --- | --- |
| P2-1 contenteditable ProseEditor | 推迟 Sprint 2 | P0-7 明确用**现有 textarea ChapterEditor（AI 隐藏）**即可交付免费闭环；contenteditable 是最大新件、N8 返工风险最高，应在纵切闭环验证后再做（N8 策略本迭代定稿落盘，作为 P2 前置资产） |
| P2-2 ~ P2-8（EditorToolbar / 抽屉 / AdvancedSettings / AdvancedOutline / archives 视图 / token 双主题 / 01-04 对齐 / E2E 补测） | 推迟 Sprint 2 | UI&UX 改版依赖 P0 闭环稳定；设定/大纲高级视图面向 PRO，不阻塞免费主流程 |
| P3 全量（PRO 解锁逻辑） | 推迟 Sprint 3+ | 本迭代只需**接口占位**：tier 开关 + 能力清单 + 端点 403 门控，已由 P0-4 / P0-6 覆盖 |
| N6 unarchive（取消归档端点） | 推迟 Sprint 2 | consensus 明确 P2 级；P0/P1 归档单向（只读可用）即满足 P0 锚点「归档只读可用」 |
| N16 抽屉→高级大纲跳转 | 推迟 Sprint 2 | 属 P2-3；P0 抽屉「去写正文」已闭环 |
| C 端 Alembic 硬化 | **裁剪** | tech-backend §4.1 标可选；`create_all` + 幂等回填已可跑通，与现状 `ALTER TABLE` 加列模式一致 |
| 编辑器内归档只读（contenteditable 只读态） | 推迟 Sprint 2 | B6 明确「现状归档后 textarea 仍可编辑」是全新工作；MVP 用 textarea `readOnly` + `ArchiveBanner` + 树同步满足「归档只读可用」，完整只读体验随 ProseEditor 落地 |

### 1.3 取舍理由（Why）

1. **MVP 用 textarea 而非 contenteditable**：P0 的核心价值是「免费建书即写、不被流程/AI 绑架」，编辑器交互升级（N8）是 UX 增值，不是闭环门槛。先用存量 textarea 跑通全链路，把最高返工风险的新件（contenteditable）放到有稳定纵切可回归的下一迭代。
2. **P1 不裁剪**：树过滤（N1 空章弱化）、字数口径（B5）、归档/进度状态同步都依赖 DB 元数据；若砍 P1，P0-7 只能停在降级树，验收锚点「空章「未写」弱化可见」「树/进度同步」无法真实通过。
3. **P2/P3 推迟的边界**：P2 的 AdvancedSettingsView / AdvancedOutlineView 面向 PRO 高级字段，与免费闭环正交；P3 是付费解锁逻辑，本迭代的 403 门控占位已确保免费态无 AI 能力泄漏。

---

## 2. 开发顺序（拓扑排序 + 并行轨道）

三条并行轨道在 P0-7 汇合：

```
Track A 决策/文档：P0-1 ─────────────────────────────► 落盘 P2 前置资产（N8 策略）
Track B 后端门控+归档：P0-2 → P0-3 ─────┐
Track C 后端数据底座：P1-1 → P1-2 → P1-3 → P1-4 → P1-6 → P1-5 ─┤
Track D 前端两态地基：P0-4 → P0-6 / P0-5 ───────────────┘
汇合：P0-7 免费主流程纵切（前端，消费 B/C/D 全部契约）
收尾：P1-7 后端测试（∥ P0-8） → P0-8 闭环验证 + 联调
```

- **关键路径**：`P1-1 → P1-2 → P1-3 → P1-4 → P1-5 → P0-7 → P0-8`（P1 数据底座是横跨最长的一条并行轨道，决定总时长）。
- **并行窗口**：Track B/C（后端）× Track D（前端）从 Day 1 起并行；P0-2/P0-4/P1-1 三者无依赖，可同时开工。
- **汇合纪律**：P0-7 不得先于 P1-5 开工（消费最终 `GET /volumes` 契约）；P0-8 不得早于 P0-7 完成。
- **估算基准**：S ≤ 1.5 人日 · M = 2–4 人日 · L = 5–8 人日。容量建议：2 前端 + 2 后端 + 1 测试，约 3–4 周。若容量吃紧，**释放阀 = P1-2~P1-7 顺延**，保留 P0 + 降级树作为已交付 MVP。

---

## 3. 任务清单（估算 / 前置 / 风险 / 验收）

### P0-1 — PRD v1.1 收敛 + contenteditable 受控策略定稿（N8）
- **估算**：S（纯文档，前端/后端无代码）
- **前置**：—
- **风险**：N8 受控回写策略未定稿 → P2-1 最大新件返工。对策：策略以文档落盘并通过前端评审后，P2 才允许开工。
- **验收**：PRD §2/§5.1/§5.2/§5.4/§8 按 N1–N17 + O1/O6 修订完成；03-settings 6/7 进度 bug 修复口径落盘；N8 DOM→state 单向 / IME 守卫 / 粘贴净化 / 纯文本序列化四条约成定稿。

### P0-2 — tier 感知门控旁路层 `workflow/tier.py`（N9 + B4）
- **估算**：M（后端）
- **前置**：—
- **风险**：旁路条件误判误伤 PRO gate 语义。对策：`tier_bypass` = `tier=="none"` **或 过期付费 `check_permission` allowed==False**（BE P2-I），非裸 tier 字符串；接入点统一收口 `tier_or_gate` / `tier_phase_transition`，杜绝逐点修补；顺带修 `gate_archived` `.yaml/.md` bug（B4）。
- **验收**：create_volume / confirm_chapter / workflow/transition 三处接入；phase-status free 返 `tier_bypass:true`；免费下 update_phase 旁路 `can_transition`（O3 幂等推进）。

### P0-4 — 两态地基 `LicenseProvider` + `useTier` + `lib/features.ts` + `FeatureTier`
- **估算**：M（前端）
- **前置**：—
- **风险**：tier 数据源依赖 `/auth/verify`（本地模拟已具备，无阻塞）；能力清单若混入运营判定会散落 `if(tier)`。对策：能力清单只管功能显隐，免费限 1 本/试用横幅保留直判（FE P2-1）。
- **验收**：`{tier,isFree,isPro}` 单一数据源挂 `NovelLayout`；`<TierGate feature>` / `<TierField feature locked>` 可用。

### P1-1 — `volumes`/`chapters` 数据表 + 模型注册 + `projects.index_status` 列
- **估算**：S（后端）
- **前置**：—
- **风险**：`create_all` 建表与现有 lifespan 兼容；删卷级联删章（ORM cascade + FK ondelete 双保险）。对策：`models/__init__.py` 注册，`main.py` create_all 自动建表；relationship `cascade="all, delete-orphan"`。
- **验收**：启动自动建两表；字段/索引/UNIQUE 对齐 development-plan §5。

### P0-3 — 归档免费化（移除 require_ai_access + AI 摘要降级 + N9 不 500）
- **估算**：M（后端）
- **前置**：P0-2（归档走 tier_phase_transition 旁路）
- **风险**：archive 现有 `update_thread_state`/`update_character_states` 副作用；无 Key 时 `get_ai_client()` 抛异常。对策：AI 摘要 try/except（ValueError + chat 异常）降级为正文首 200 字（BE B2/D4）；`POST /chapters/{ref}/archive` 与 `GET /archives*` 移除 `require_ai_access`。
- **验收**：无 API Key 可归档、摘要降级、DB `status='archived'/archived_at` 落库、免费不 500。

### P0-6 — AI 面免费隐藏 + AI 端点 403 补全
- **估算**：M（前端 + 后端）
- **前置**：P0-4
- **风险**：漏挂端点导致免费绕过（D5）；AI 代码保留但需确保免费态顶层不渲染。对策：后端补挂 `settings/ai_router.generate_field` 的 `require_ai_access`；前端 RightToolbar / ChapterEditor prompt tab / PromptManagementPage / AiReview 挂 FeatureTier 隐藏（N14，代码保留）。
- **验收**：免费态所有 AI 入口不渲染；免费直呼任一 AI 端点返回 403。

### P0-5 — 新书默认落点正文工作台 + PRO 容器（N14）
- **估算**：M（前端）
- **前置**：P0-4
- **风险**：`useNovelState` 若在免费态被消费会导致 hook 条件调用；isNew 判断与两态耦合。对策：TabProgressButton / GateBanner / OnboardingCard 收进 PRO 容器，免费态顶层不渲染该子树；`fetchPhaseStatus` 由 PRO 容器内部触发。
- **验收**：新建书直达工作台（非设定）；免费态无阶段催促 UI。

### P1-2 — 幂等回填 `index_volumes_chapters` + lifespan 挂载
- **估算**：L（后端）
- **前置**：P1-1
- **风险**：**回填非幂等 / 重复索引（G1 最大数据风险）**；内嵌列表 word_count 不可信（B1）。对策：INSERT-if-missing + `index_status` run-once + 只增不删；以 `chapters/{ref}.yaml` 为准；孤儿章建占位卷；`import_persist` 调 per-project `reindex_project`；自愈 projects 冗余计数。
- **验收**：回填跑两遍行数不变；import 项目即列表可用。

### P1-3 — VolumeService + VolumeRepository + 卷端点改造
- **估算**：M（后端）
- **前置**：P1-1、P1-2
- **风险**：delete 级联删文件面大（YAML/versions/archives）；`{ref}` 需容 `.yaml` 尾缀。对策：先删 DB 行（CASCADE）再删文件、顺序固定；`strip_suffix(".yaml")` 容错；create 用 `MAX(volume_no)+1` 并忽略 body.vol_num（B9）。
- **验收**：卷 list/create/update/delete 全走 DB，title/summary 双写、PRO outline 字段只写 YAML、update 时 `pop("chapters")` 清派生快照。

### P1-4 — ChapterService + ChapterRepository + 章端点改造（双写核心）
- **估算**：L（后端）
- **前置**：P1-1、P1-2、P0-2
- **风险**：**双写一致性（G1 最大风险）**——YAML 先写、DB 后更、DB 失败降级不 500、读路径自愈。对策：`refresh_chapter_meta` 以重读 YAML 为准（P1-C）只覆盖本次变更字段、包 try/except + warning；`ensure_volume_row` 懒补前置（B10/P1-D）；`save_prose` 新增 `PUT .../prose` 专用端点（#12）；confirm 走 tier_or_gate；versions restore 后刷 word_count/has_prose/status/outline_status/confirmed_at。
- **验收**：create MAX+1、不写 YAML 内嵌列表；章号自增；级联清理 + 计数维护；字数口径与前端 `countChars` 一致（B5/P2-J）。

### P1-6 — `write/_stream_chapter` 补 `refresh_chapter_meta`（N10）+ `novel_to_dict` 补 type/genre
- **估算**：S（后端）
- **前置**：P1-4
- **风险**：低。对策：PRO AI 流式写正文后刷新 DB 字数/状态，不陈旧。
- **验收**：AI 写作落库后树/字数即时刷新；小说列表类型位数据源就绪（FE 2.2-6）。

### P1-5 — `GET /volumes` 全量树 + `build_project_tree` 改 DB + breaking change 迁移（N11）
- **估算**：M（后端 lead + 前端协作）
- **前置**：P1-3、P1-4
- **风险**：**breaking change 未同 commit 迁移 → 前端 / test_readiness 断裂**。对策：`GET /volumes` 返回全量树（含 has_prose/archived/outline_status）、**正文过滤在前端**（N1）；`POST /volumes/{ref}/chapters` 替代旧 `POST /chapters`；**同 commit** 迁移前端 `NovelPage.loadVolumes` 与 `test_readiness.py`。
- **验收**：`useOutline` 前端零改动复用 DB 树；三个 breaking change 点在同一 commit 完成；`/tree` 字数口径与编辑器一致。

### P0-7 — 免费主流程纵切（NovelWorkspace 四态视图机 + 工作台 UI + 存量编辑器 + 状态栏）
- **估算**：L（前端）
- **前置**：P0-2、P0-3、P0-4、P0-5、P1-5
- **风险**：**最大前端重构**——NovelPage ~1100 行拆为 NovelWorkspace + 四视图；路由收敛删除死子路由；WritingTree 过滤依赖 has_prose。对策：Workbench 常驻挂载、切视图 `hidden` 保 prose 脏状态/光标（FE P1-1）；树用 DB `has_prose`（N1 前端过滤）；NovelBar 含「高级配置 ▾」入口（N3）；新建「第一章」即达编辑器（N1 显式验收）。
- **验收**：建书即写 → 树 CRUD（+新建卷/章、hover 重命名/删除）→ 抽屉（卷名+摘要 / 章名+摘要+目标字数 N5）→ 自动保存 → 归档只读（textarea readOnly + 提示条 + 树同步）闭环；主工作台可见「高级配置 ▾」。

### P1-7 — 后端测试套件（六套件 + test_readiness 迁移）
- **估算**：L（后端测试）
- **前置**：P1-3、P1-4、P1-5、P1-6、P0-2、P0-3
- **风险**：覆盖不足致双写漂移回归。对策：`test_volume_chapter_index`（回填幂等/孤儿/import/run-once）、`test_dual_write`、`test_volume_chapter_crud`（级联删/章号自增）、`test_free_bypass`（tier=none 全放行 + 归档不 500 N9）、`test_archive_free`（无 Key/免费可读）、`test_tree_db`（DB 树 + has_prose）；`test_readiness` 迁移到新端点。
- **验收**：`python -m pytest tests/ -v` 全绿（新增套件 + 既有 66 测试回归）。

### P0-8 — 免费主流程闭环验证 + 后端联调
- **估算**：M（前端 + 后端 + QA）
- **前置**：P0-2 ~ P0-7（P1-7 并行）
- **风险**：联调暴露契约不一致。对策：验收对齐 consensus §4 P0 锚点；P1-5 breaking change 已在同 commit 迁移，联调聚焦免费 bypass / 归档不 500 / AI 403。
- **验收**：免费主流程 E2E 通过；全程无 AI 字段/提示词/阶段催促 UI；免费直呼 AI 端点 403；免费归档不 500。

---

## 4. MVP 截止线与 Definition of Done

### 4.1 MVP 截止线（本次迭代硬性交付，可独立验收的最小闭环）

> 对应 development-plan §8 P0 期 + consensus §4 P0 期。达到该线即可对外演示「免费建书即写」核心价值，P1 数据底座作为闭环完整性的后半程同迭代补完。

1. 免费建书（只填书名）→ **直达正文工作台可写**（P0-5 / P0-7）。
2. 工作台树常驻「+ 新建卷」「+ 新建章」→ 新建「第一章」**即达编辑器**（N1）。
3. 树 CRUD：新建 / hover 重命名 / 删除（N2）；空章「未写」弱化可见、不硬过滤（N1）。
4. 卷/章轻量配置抽屉：卷名+卷摘要 / 章名+章摘要+**目标字数可调**（N5）；「去写正文」直达编辑器。
5. 正文写作：存量 textarea 编辑器（AI 隐藏）+ 自动保存 + 实时字数 + 保存四态含重试。
6. 归档只读可用：归档后 textarea 只读 + 顶部提示条 + 树 📦 同步 + 进度定格；**免费归档不 500**（N9）。
7. 主工作台小说栏可见「**高级配置 ▾**」（设定/大纲）入口 + 「可选」标注（N3）。
8. 全程无阶段催促 UI、无 AI 字段、无提示词；免费直呼任一 AI 端点返回 403（P0-6）。

### 4.2 Definition of Done（迭代级质量门）

**后端质量门**
- [ ] `cd client/backend && python -m pytest tests/ -v` 全绿：新增 P1 六套件 + 既有 66 测试回归。
- [ ] `test_free_bypass`：tier=none 全放行 + phase-status 带 `tier_bypass`；免费归档不 500；免费 AI 端点 403。
- [ ] 双写一致性：YAML 内容唯一属主 + DB 结构准；回填幂等（跑两遍行数不变）；写路径不再维护 YAML 内嵌 chapters 列表；`ensure_volume_row` 读路径自愈。

**前端质量门**
- [ ] `cd client/frontend && npx tsc --noEmit && npm run build` 通过。
- [ ] 免费主流程 E2E 通过：建书即写 → 树 CRUD → 抽屉 → 自动保存 → 归档只读；N1 新建章节即达编辑器；全程无 AI 字段与提示词。
- [ ] `client/frontend/AGENTS.md` 过时误导内容（B8）不参与实现依据。

**产品验收锚点**
- [ ] P0 + P1 两期锚点全部通过（development-plan §8 / consensus §4）。

**文档前置资产**
- [ ] N8 contenteditable 受控回写策略定稿落盘（Sprint 2 ProseEditor 的前置输入）。

---

## 5. 跨团队协作点

| # | 协作点 | 涉及 | 时序 / 纪律 |
| --- | --- | --- | --- |
| 1 | **breaking change 迁移（N11）**：`GET /volumes` 全量树 + `POST /volumes/{ref}/chapters` 替代旧 `POST /chapters` | 后端 lead + 前端协作 | P1-5 同 commit 完成前端 `loadVolumes` + `test_readiness.py` 迁移，禁止跨 commit 断裂 |
| 2 | **树契约（N1）**：`GET /volumes` 返回 has_prose/archived/outline_status，**过滤在前端** | 后端 → 前端 | P1-5 先行，P0-7 消费最终形状；降级树仅作 P1 未达时的停靠 |
| 3 | **tier 契约**：前端 `useTier` 消费 `/auth/verify` 的 `{tier,isFree,isPro}`；后端 phase-status 免费返 `tier_bypass:true` | 前端 + 后端 | P0-2 / P0-4 并行开发，接口先行对齐；本地模拟 S 端已具备 |
| 4 | **免费主流程联调（P0-8）**：前端 E2E × 后端免费 bypass / 归档 / AI 403 | 前端 + 后端 + QA | P0-7 完成即开联调窗口；QA 补免费主流程 E2E 用例 |
| 5 | **双写一致性评审**：`refresh_chapter_meta` 以 YAML 为准 + `ensure_volume_row` 懒补前置 | 后端内部（服务层 × workflow） | P1-4 开工前对齐 B1/B5/P1-C/P1-D 口径；字数函数前后端共用 |
| 6 | **token 映射表（N7，Sprint 2 前置）**：mockup → daisyUI token | 设计 → 前端 | 本迭代可先冻结映射表文档，不阻塞 P0/P1 交付 |

---

## 6. 风险总表（TOP 5）

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| 双写漂移（G1，YAML↔DB 不一致） | 高 | YAML 内容准 + DB 结构准；写路径停维护内嵌列表；读路径懒补自愈；回填幂等；测试套件覆盖 |
| breaking change 未同 commit 迁移（N11） | 高 | P1-5 强制同 commit（后端 + 前端 loadVolumes + test_readiness） |
| contenteditable 受控回写返工（N8） | 高（跨迭代） | P0-1 定稿策略并评审通过；P2-1 才可开工；MVP 先用 textarea 隔离风险 |
| 免费 gate 误伤 / 绕过（D5/B4） | 中 | 旁路条件 = tier==none 或过期付费；AI 端点 403 全挂（含 generate_field）；FeatureTier 双保险 |
| 回填非幂等 / 重复索引（G1） | 中 | INSERT-if-missing + `index_status` run-once + 只增不删；内嵌 word_count 不可信以文件为准 |

---

## 7. Sprint 2 预告（本次未排）

- P2-1 contenteditable ProseEditor（N8 落地 + 字号/行距/专注 + 归档只读完整态）
- P2-2 ~ P2-8：EditorToolbar / 抽屉 / AdvancedSettingsView（7 项重映射 N12）/ AdvancedOutlineView（N15 四态）/ archives 视图 + unarchive（N6）/ token 双主题（N7）/ 01-04 高保真对齐 + E2E 补测
- P3-1 PRO 解锁接口占位（tier 开关 + 能力清单 + 端点门控；P0-4/P0-6 已埋）
