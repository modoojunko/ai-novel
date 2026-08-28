# Sprint 1 总执行清单（todo-merged v1）

> 合并 4 份输出：`sprint-plan.md`（Sprint Prioritizer 排期）+ `todo-backend.md`（18 BE）+ `todo-frontend.md`（35 FE）+ `todo-test.md`（29 TE）。
> 用途：单一可执行清单，按 Sprint 任务序号 → BE/FE/TE 待办 → openspec change 分组的完整映射；openspec 逐个开发时以此为准绳。

---

## 0. 迭代边界（Sprint 1）

- **硬承诺（MVP 截止线）**：P0-1 ~ P0-8 全量
- **次优先（锁定范围）**：P1-1 ~ P1-7 全量
- **推迟 Sprint 2**：P2-1~P2-8（contenteditable ProseEditor / EditorToolbar / 抽屉 / AdvancedSettingsView / AdvancedOutlineView / archives+unarchive / token 双主题 / 01-04 对齐+E2E 补测）、N6 unarchive、N16
- **范围外**：P3 PRO 解锁逻辑（本迭代只留接口占位）

---

## 1. 执行映射总表（Sprint 任务 × 三轨待办 × openspec change）

| Sprint 任务 | 阶段 | 后端 BE | 前端 FE | 测试 TE | openspec change |
| --- | --- | --- | --- | --- | --- |
| P0-1 PRD v1.1 收敛 + N8 策略定稿 | P0（纯文档） | — | — | — | `001-prd-convergence`（文档前置资产） |
| P0-2 tier 门控旁路层 `workflow/tier.py` | P0 | BE-04 | — | TE-01, TE-02 | `002-tier-free-bypass` |
| P0-3 归档免费化 + AI 摘要降级 | P0 | BE-05 | — | TE-03 | `002-tier-free-bypass` |
| P0-4 两态地基（LicenseProvider/features/FeatureTier） | P0 | — | FE-01, FE-02, FE-03, FE-04 | TE-15 | `003-two-tier-foundation` |
| P0-5 新书落点正文工作台 + PRO 容器 | P0 | — | FE-05, FE-06, FE-07 | TE-16, TE-29 | `004-free-workspace` |
| P0-6 AI 面免费隐藏 + AI 端点 403 补全 | P0 | BE-17 | FE-12, FE-35（占位） | TE-05, TE-29 | `002-tier-free-bypass` + `004-free-workspace` |
| P0-7 免费主流程纵切（NovelWorkspace + 工作台） | P0 | — | FE-08, FE-09, FE-10, FE-11, FE-13, FE-14, FE-28 | TE-17, TE-28 | `004-free-workspace` |
| P0-8 闭环验证 + 后端联调 | P0 | — | FE-34 | TE-17 | `004-free-workspace`（E2E 收尾） |
| P1-1 volumes/chapters 表 + index_status 列 | P1 | BE-01 | — | TE-06 | `005-index-db-base` |
| P1-2 幂等回填 + lifespan 挂载 | P1 | BE-02, BE-03 | — | TE-07 | `005-index-db-base` |
| P1-3 VolumeService + 卷端点改造 | P1 | BE-06, BE-07 | — | TE-08 | `006-volume-chapter-service` |
| P1-4 ChapterService + 章端点改造（双写核心） | P1 | BE-08, BE-09, BE-10, BE-11, BE-12, BE-13 | — | TE-09, TE-10 | `006-volume-chapter-service` |
| P1-5 GET /volumes 全量树 + build_project_tree 改 DB | P1 | BE-15 | FE-29, FE-30 | TE-12, TE-13 | `007-tree-db-migration` |
| P1-6 _stream_chapter 补 refresh + novel_to_dict | P1 | BE-16 | — | TE-14 | `007-tree-db-migration` |
| P1-7 后端测试套件 | P1 | BE-18 | — | TE-06~14 | `008-backend-test-suite` |

---

## 2. 开发顺序（拓扑排序，来自 sprint-plan §2）

```
Track A  文档：P0-1（001）
Track B  后端门控+归档：P0-2 → P0-3（002，含 BE-17）
Track C  后端数据底座：P1-1 → P1-2 → P1-3 → P1-4 → P1-6 → P1-5（005 → 006 → 007）
Track D  前端两态地基：P0-4（003）→ P0-5/P0-6（004 前半）
汇合：P0-7 免费主流程纵切（004 后半，消费 B/C/D 全部契约）
收尾：P1-7 后端测试（008）∥ P0-8 闭环验证 + E2E
```

**关键路径**：`P1-1 → P1-2 → P1-3 → P1-4 → P1-5 → P0-7 → P0-8`
**汇合纪律**：P0-7 不得先于 P1-5 开工（消费最终 `GET /volumes` 契约）；P0-8 不得早于 P0-7。

---

## 3. openspec change 分组定义（8 个 change）

> 每个 change = 一个可独立 apply/archive 的 openspec 单元，tasks.md 内含对应 BE/FE/TE 待办勾选项。命名 `NNN-<kebab-case>` 保留序号以维持拓扑顺序。

### 001-prd-convergence（纯文档，Track A）
- **内容**：PRD §2/§5.1/§5.2/§5.4/§8 按 N1–N17 + O1/O6 修订；03-settings 6/7 进度 bug 修复口径落盘；N8 contenteditable 受控策略四条约成定稿。
- **对应 sprint 任务**：P0-1
- **验收**：见 sprint-plan §P0-1 验收。

### 002-tier-free-bypass（后端 P0 核心，Track B）
- **内容**：`workflow/tier.py`（tier_bypass / tier_or_gate / tier_phase_transition）+ 接入点（create_volume / confirm_chapter / workflow/transition / archive）+ phase-status `tier_bypass:true` + `gate_archived` 改 DB COUNT（B4）+ 归档免费化（移除 require_ai_access + AI 摘要降级）+ `generate_field` 补挂 require_ai_access（D5/BE-17）。
- **待办**：BE-04、BE-05、BE-17 ｜ TE-01、TE-02、TE-03、TE-05
- **验收**：tier=none 全闸门放行 + 归档不 500（N9）+ AI 端点 403；`python -m pytest tests/test_free_bypass.py tests/test_archive_free.py tests/test_settings_ai.py -v`。

### 003-two-tier-foundation（前端两态地基，Track D 起点）
- **内容**：`LicenseProvider` + `useTier` + `lib/features.ts` 能力清单 + `FeatureTier`（TierGate/TierField）+ `NovelLayout` 挂 Provider + 项目壳。
- **待办**：FE-01、FE-02、FE-03、FE-04 ｜ TE-15
- **验收**：任意后代 `useTier()` 可取 `{tier,isFree,isPro}`；`/auth/verify` 仅 1 次；`tsc --noEmit` 通过。

### 004-free-workspace（前端免费主流程纵切，Track D 主体）
- **内容**：`NovelWorkspace` 四态视图机 + PRO 容器（N14）+ 路由收敛 + `useWorkbench` + `NovelBar`（高级配置▾ N3）+ Breadcrumb + Workbench 两栏 + WritingTree（+新建卷/章、N1 空章弱化、N2 hover）+ ChapterEditor 重构（AI 隐藏）+ `useChapterData` + BottomStatusBar + EmptyState 建书即写 + E2E。
- **待办**：FE-05、FE-06、FE-07、FE-08、FE-09、FE-10、FE-11、FE-12、FE-13、FE-14、FE-28、FE-34 ｜ TE-16、TE-17、TE-28、TE-29
- **验收**：P0 断点 1（sprint-plan §4.1 全部 8 条）+ 免费主流程 E2E 全绿。

### 005-index-db-base（后端数据底座第一段，Track C 起点）
- **内容**：`volumes`/`chapters` 模型 + `index_status` 列 + repositories 查询层 + `ensure_volume_row` + `count_chars` + 幂等回填 `index_volumes_chapters` + lifespan 挂载 + import 调 reindex。
- **待办**：BE-01、BE-02、BE-03 ｜ TE-06、TE-07
- **验收**：启动自动建表；回填跑两遍行数不变；import 项目即列表可用。

### 006-volume-chapter-service（后端双写核心，Track C）
- **内容**：VolumeService（list/create/get/update/delete + MAX+1 + 双写）+ ChapterService（create + POST /volumes/{ref}/chapters 替代 + save_chapter/save_prose + refresh_chapter_meta + 读路径自愈 + confirm + delete + versions restore 刷新）。
- **待办**：BE-06、BE-07、BE-08、BE-09、BE-10、BE-11、BE-12、BE-13 ｜ TE-08、TE-09、TE-10
- **验收**：卷/章 CRUD 双写一致、以 YAML 为内容准、DB 失败降级不 500、懒补自愈；`test_dual_write` / `test_volume_chapter_crud` 绿。

### 007-tree-db-migration（树改 DB + breaking change 迁移，Track C 收口）
- **内容**：`GET /volumes` 全量树（DB 查询、含 has_prose/archived/outline_status、不过滤）+ `build_project_tree` 改 DB（`GET /tree` 结构不变）+ `POST /volumes/{ref}/chapters` breaking change + 同 commit 迁移前端 `loadVolumes`/`useOutline`/`VolumeEditor` + `write/_stream_chapter` 补 refresh（N10）+ `novel_to_dict` 补 type/genre。
- **待办**：BE-15、BE-16、FE-29、FE-30 ｜ TE-12、TE-13、TE-14
- **验收**：`useOutline` 前端零改动复用 DB 树；三个 breaking change 点同一 commit；`test_tree_db` / `test_readiness` / `test_workflow_api` 迁移后全绿。

### 008-backend-test-suite（后端测试收尾，∥ P0-8）
- **内容**：六套件（test_volume_chapter_index / test_dual_write / test_volume_chapter_crud / test_free_bypass / test_archive_free / test_tree_db）+ test_readiness/test_workflow_api/test_settings_ai 迁移。
- **待办**：BE-18 ｜ TE-01~TE-14
- **验收**：`cd client/backend && python -m pytest tests/ -v` 全绿（新增套件 + 既有 66 测试回归）。

---

## 4. MVP 截止线（sprint-plan §4.1 摘要，验收锚点）

1. 免费建书（只填书名）→ 直达正文工作台可写
2. 工作台树常驻「+ 新建卷」「+ 新建章」→ 新建「第一章」即达编辑器（N1）
3. 树 CRUD：新建 / hover 重命名 / 删除（N2）；空章「未写」弱化可见
4. 卷/章轻量配置抽屉：卷名+摘要 / 章名+摘要+目标字数（N5）；「去写正文」直达
5. 正文写作：存量 textarea（AI 隐藏）+ 自动保存 + 实时字数 + 保存四态含重试
6. 归档只读可用：textarea 只读 + 提示条 + 树 📦 同步 + 进度定格；免费归档不 500（N9）
7. 主工作台小说栏可见「高级配置 ▾」入口 + 「可选」标注（N3）
8. 全程无阶段催促 UI、无 AI 字段、无提示词；免费直呼任一 AI 端点 403（P0-6）

---

## 5. 协作点速查（sprint-plan §5，开发时守纪律）

| # | 协作点 | 纪律 |
| --- | --- | --- |
| 1 | breaking change 迁移（N11）：`GET /volumes` + `POST /volumes/{ref}/chapters` | P1-5 同 commit 完成前端 `loadVolumes` + `test_readiness.py`，禁止跨 commit 断裂 |
| 2 | 树契约（N1）：`GET /volumes` 返回 has_prose/archived/outline_status，过滤在前端 | P1-5 先行，P0-7 消费最终形状 |
| 3 | tier 契约：前端 `useTier` 消费 `/auth/verify`；后端 phase-status 免费返 `tier_bypass:true` | P0-2 / P0-4 并行，接口先行对齐 |
| 4 | 免费主流程联调（P0-8） | P0-7 完成即开联调窗口 |
| 5 | 双写一致性评审：refresh_chapter_meta 以 YAML 为准 + ensure_volume_row 懒补 | P1-4 开工前对齐 B1/B5 口径 |
| 6 | token 映射表（N7，Sprint 2 前置） | 本迭代先冻结映射表文档，不阻塞 P0/P1 |

---

## 6. 状态栏（openspec 开发时逐项勾选）

### Track A / 文档
- [ ] P0-1 PRD 收敛 + N8 策略（change 001）

### Track B / 后端 P0
- [ ] BE-04 tier 旁路层（change 002）
- [ ] BE-05 归档免费化（change 002）
- [ ] BE-17 generate_field 403（change 002）
- [ ] TE-01/02/03/05 后端 P0 测试（change 002/008）

### Track D / 前端 P0
- [ ] FE-01~04 两态地基（change 003）
- [ ] FE-05~07 工作台骨架（change 004）
- [ ] FE-08~14, FE-28 免费主流程纵切（change 004）
- [ ] TE-15/16/17/28/29 前端测试（change 003/004/008）

### Track C / 后端数据底座
- [ ] BE-01/02/03 建表+repo+回填（change 005）
- [ ] BE-06~13 卷章服务（change 006）
- [ ] BE-15/16 树 DB + breaking change（change 007）
- [ ] FE-29/30 前端数据契约联调（change 007）
- [ ] BE-18 后端测试套件（change 008）

### 收尾
- [ ] P0-8 闭环验证 + E2E（change 004）
