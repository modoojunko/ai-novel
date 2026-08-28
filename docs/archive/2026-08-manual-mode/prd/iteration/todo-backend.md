# C 端改版 · 后端任务拆解（todo-backend v1）

> 由 Backend Architect 依据 `development-plan.md` v2 §4/§5/§7、`tech-backend.md` v2、`reviews/consensus.md` v2 与现状代码 `client/backend/` 拆解。
> 定位：把开发计划中**后端**相关任务拆成可执行 todo（表/服务/端点/迁移粒度），供迭代排期与验收。
> 编号 BE-xx；估算 S(<1d) / M(1-2d) / L(3-5d)；依赖引用前置 todo 编号。

---

## 0. 现状基线（代码事实，非假设）

| 事实 | 证据 |
| --- | --- |
| C 端无 Alembic，`main.py` lifespan 用 `Base.metadata.create_all` + 手工 `ALTER TABLE`（`source`/`backfill_status` 列即如此） | `client/backend/main.py:41-76` |
| 卷/章端点全部在 `chapters/router.py`；`GET /volumes` 靠 `list_dir` 文件扫描，返回 `[{filename,name}]` | `chapters/router.py:14-28` |
| `POST /volumes` 用 `body.vol_num`（缺省 `total_volumes+1`），且 `project.total_volumes = vol_num`（覆盖式，删卷后会错） | `chapters/router.py:47-61` |
| `POST /chapters` 写 YAML + 同步维护 `vol-N.yaml` 内嵌 chapters 列表（G1 双写漂移源） | `chapters/router.py:118-185` |
| `confirm_chapter` 调 `gate_chapter_ready`（hard）+ 同步内嵌列表 | `chapters/router.py:251-285` |
| `archive/router.py` 归档/读归档全挂 `require_ai_access`；`archive/service.py` 直接 `await get_ai_client()` 无 Key 抛 ValueError → 500（B2） | `archive/router.py:23-82`、`archive/service.py:36-54` |
| `update_phase` 非法跳转抛 ValueError（free 归档 500 根因，N9） | `workflow/engine.py:26-34` |
| `gate_archived` 查 `.yaml` 但归档文件是 `.md` → 归档阶段永远 in_progress（B4） | `workflow/gates.py:161-174` |
| `novels/service.build_project_tree` 文件扫描重建树；word_count=`len(prose)` 含空白（B5）；内嵌列表 word_count 恒 0 场景（B1） | `novels/service.py:147-182` |
| `novels/router.import_persist` 写 YAML + 建 Novel 记录，未回填卷/章元数据 | `novels/router.py:339-464` |
| `settings/ai_router.generate_field` 漏挂 `require_ai_access`（D5） | `settings/ai_router.py:79-126` |
| `write/router._stream_chapter` 写 YAML 后不刷 DB（N10） | `write/router.py:82-118` |
| tier 来源：`auth_local/service.check_permission`，`tier=="none"` = 免费（allowed=True）；付费过期 allowed=False | `auth_local/service.py:286-325` |
| 前端消费点：`NovelPage.tsx loadVolumes` 读 `GET /volumes`（`v.filename/v.name`）；`useOutline.refetchTree` 读 `GET /tree`（VolumeEntry 结构需保持）；`POST /chapters` 在 `NovelPage.tsx:517` | `client/frontend/src/pages/NovelPage.tsx:261-528`、`client/frontend/src/hooks/useOutline.ts:155-165` |

---

## 1. 任务清单总览（按依赖拓扑排序）

| # | 任务 | 阶段 | 依赖 | 估算 |
| --- | --- | --- | --- | --- |
| BE-01 | volumes/chapters 数据表模型 + 建表 | P1 | — | M |
| BE-02 | repositories 查询层 + ensure_volume_row + count_chars 字数函数 | P1 | BE-01 | M |
| BE-03 | 幂等回填 index_volumes_chapters + lifespan 挂载 | P1 | BE-01, BE-02 | L |
| BE-04 | tier 门控旁路层 workflow/tier.py（含 update_phase force + gate_archived 修复） | P0 | BE-01, BE-02 | L |
| BE-05 | 归档免费化 + AI 摘要降级（P0 核心） | P0 | BE-04 | M |
| BE-06 | VolumeService.list_volumes + create_volume（改 DB + MAX+1 + 双写） | P1 | BE-02, BE-04 | L |
| BE-07 | VolumeService.get/update/delete + {ref} 容 .yaml | P1 | BE-06 | L |
| BE-08 | ChapterService.create_chapter + POST /volumes/{ref}/chapters 替代（breaking change 同 commit） | P1 | BE-02, BE-04 | M |
| BE-09 | ChapterService.save_chapter/save_prose + refresh_chapter_meta（双写核心） | P1 | BE-02, BE-08 | L |
| BE-10 | GET /chapters/{ref} 合并 DB 元数据 + 读路径自愈 | P1 | BE-02, BE-08 | M |
| BE-11 | confirm_chapter（tier_or_gate + DB 状态写 + 不写内嵌列表） | P1 | BE-04, BE-08 | S |
| BE-12 | delete_chapter（级联清理 + 计数维护） | P1 | BE-02, BE-08 | S |
| BE-13 | versions restore 后刷新 DB 元数据 | P1 | BE-09 | S |
| BE-14 | archive DB 双写 + unarchive 端点（P2, N6） | P2 | BE-02, BE-05, BE-10 | M |
| BE-15 | GET /volumes 全量树 + build_project_tree 改 DB + breaking change 迁移 | P1 | BE-06, BE-08 | L |
| BE-16 | write/_stream_chapter 补 refresh（N10）+ novel_to_dict 补 type/genre | P1 | BE-09 | S |
| BE-17 | settings/ai_router.generate_field 补挂 require_ai_access（D5） | P0 | — | S |
| BE-18 | 后端测试套件 | P1 | BE-03~BE-17 | L |

> P0 阶段 = BE-04/BE-05/BE-17（免费主流程不 500/403）；P1 阶段 = 数据底座 + 双写 + breaking change；P2 阶段 = BE-14（unarchive，N6）。
> 特别标注（见各 todo）：**建表 BE-01**、**幂等回填 BE-03**、**双写一致性 BE-09/BE-10（YAML 先写 DB 后更 + ensure_volume_row 懒补）**、**tier 门控旁路层 BE-04（含 update_phase force）**、**归档免费化 + AI 摘要降级 BE-05**、**breaking change 端点迁移 BE-08/BE-15（GET /volumes 改 DB、POST /chapters 替代）**。

---

## 2. Todo 明细

### BE-01 · volumes/chapters 数据表模型 + 建表（表粒度）

**说明**
- 新建 `client/backend/models/volume.py`（`Volume`）与 `client/backend/models/chapter.py`（`Chapter`），在 `models/__init__.py` 注册 → `main.py` lifespan 的 `Base.metadata.create_all` 启动即建新表（与 `tests/conftest.py` `_session_test_db` 自动兼容）。
- 字段严格对齐 `development-plan.md` §5.1/§5.2：
  - `volumes`：id(PK uuid4)/project_id(FK→projects.id, NOT NULL, INDEX)/volume_no(NOT NULL)/title(String200)/summary(Text default '')/chapter_count(Int default 0)/created_at/updated_at；**UNIQUE(project_id, volume_no)**。
  - `chapters`：id(PK)/project_id(FK)/volume_id(FK→volumes.id **ON DELETE CASCADE**, NOT NULL, INDEX)/chapter_no/ref(UNIQUE(project_id, ref))/title/status(default 'outline')/word_count(default 0)/has_prose(default False)/outline_status(default 'unfilled')/confirmed_at/archived_at/created_at/updated_at；**INDEX(project_id, volume_id, status)**。
- `models/project.py`：加 `index_status` 列（String(20) default "none"，DB 层面用 `text("ALTER TABLE projects ADD COLUMN index_status TEXT DEFAULT 'none'")` 加列，同 `source`/`backfill_status` 模式）；加 `volumes = relationship("Volume", cascade="all, delete-orphan", back_populates="project")`。
- Chapter.volume_id 双保险：ORM relationship `cascade="all, delete-orphan"` + FK `ondelete="CASCADE"`（`db.py` 已 `PRAGMA foreign_keys=ON`，级联真生效）。
- **不做** `chapter_outlines` 表（章纲/正文继续整文件存 YAML）；PRO 卷纲全字段不入表。

**验收标准**
- 启动（或测试 fixture）后 SQLite 中 `volumes`/`chapters` 表存在，字段/约束/索引符合 §5.1/§5.2；`projects` 有 `index_status` 列（存量库经 ALTER 加列不报错）。
- 现有 66 个测试不回归（conftest create_all 兼容）。

**涉及文件**
- 新增：`client/backend/models/volume.py`、`client/backend/models/chapter.py`
- 修改：`client/backend/models/__init__.py`、`client/backend/models/project.py`、`client/backend/main.py`（index_status 加列）

**依赖**：无

**估算**：M

**测试要求**：`tests/conftest.py` 建表基座自动覆盖；建议新增单测用 SQLAlchemy `inspect(engine)` 断言两张表列/索引存在（可并入 BE-18）。

---

### BE-02 · repositories 查询层 + ensure_volume_row + count_chars 字数函数（服务/基础粒度）

**说明**
- 新建 `client/backend/repositories/volume_repo.py`：`list_by_project`（ORDER BY volume_no）/`get_by_ref_or_number`（容 `.yaml` 尾缀）/`get_by_volume_no`/`max_volume_no`/`upsert`（懒补用）/`count_by_project`。
- 新建 `client/backend/repositories/chapter_repo.py`：`list_by_project`（一次性拉全，供 `list_volumes` 内存分组免 N+1）/`get_by_ref`/`has`/`upsert`/`delete`/`max_chapter_no(project_id, volume_id)`/`count_by_project`/`count_archived(project_id)`（gate_archived 用）。
- **`ensure_volume_row(db, project_id, volume_no)`**（懒补统一收口，B10/P1-D）：先 upsert 卷行（title 取 YAML 或「导入卷 N」）再插章行——放 `volume_repo.py`。
- **`count_chars(text) -> int`**（B5/P2-J）：去空白中文字符数，与前端编辑器 `countChars` 同口径——`re.sub(r"\s+", "", text)` 后 `len`。放 `client/backend/novels/service.py`（或独立 `novels/count_chars.py`），供 `save_prose`/树/`novel_to_dict` 共用。
- 沿用现有**扁平 service + repositories 查询集中点**风格（D2 裁决，不引入四层骨架）；repositories 只做 DB 查询。

**验收标准**
- 各 repo 方法可查可写；`ensure_volume_row` 对「卷行缺失 + 章行缺失」可一次补全两行。
- `count_chars("  你好 世界 \n abc") == 6`（去空白后 6 个非空白字符）；与前端 `countChars` 一致。
- 单用户 + 并发（SSE 多流 + 防抖保存）下 `+=1` 与插章行同 session 同 commit（防读改写竞态）。

**涉及文件**
- 新增：`client/backend/repositories/__init__.py`、`client/backend/repositories/volume_repo.py`、`client/backend/repositories/chapter_repo.py`
- 修改：`client/backend/novels/service.py`（count_chars）

**依赖**：BE-01

**估算**：M

**测试要求**：可并入 BE-18（repo 层单测 + count_chars 口径断言）。

---

### BE-03 · 幂等回填 index_volumes_chapters + lifespan 挂载（迁移粒度）【特别标注：幂等回填】

**说明**
- 新建 `client/backend/filesystem/index_volumes_chapters.py`：
  - `index_volumes_chapters()`：遍历 `_all_project_root_paths()`（复用 `filesystem/migrate.py` 枚举模式，含 import 项目）。
  - 扫描 `volumes/vol-N.yaml`：卷行缺失才插（**INSERT-if-missing**）；遍历内嵌 chapters 列表，`ref=f"vol-{vol_no}-ch-{chapter}"`：
    - **以 `chapters/{ref}.yaml` 为准**（B1：内嵌列表 word_count 不可信），读 YAML 取 title/status/prose（`word_count=count_chars(prose)`、`has_prose=bool(prose.strip())`、`outline_status` 派生）；
    - 卷内引用但无章文件 → 插占位章行（title 取内嵌项，word_count=0）。
  - **孤儿章文件兜底**：扫描 `chapters/*.yaml` 中 DB 无行且无对应卷行 → 反查 `volume_no` 建占位卷（title 取内嵌项或「导入卷 N」）+ 章。
  - **自愈冗余计数**：`project.total_volumes=COUNT(volumes)`、`project.total_chapters=COUNT(chapters)`。
  - **run-once**：`project.index_status != "done"` 才跑；跑完置 done；判据与 INSERT-if-missing 双保险，重启幂等（D3：不复用 `backfill_status`，避免与 AI backfill 语义冲突）。
  - `reindex_project(project_id)`：per-project 变体（同逻辑但单项目 + 强制/或也查 index_status），供 `import_persist` 调用。
- `main.py` lifespan 挂载 `index_volumes_chapters()`（settings migrate 之后、tone backfill 附近；包 try/except + warning，不阻塞启动）。
- `novels/router.py::import_persist` 写完 YAML + 建记录后调用一次 `reindex_project(project_id)`，导入即列表可用（不必等下次重启）。
- **只增不删**：文件被新写路径删除的孤儿 DB 行不清理（写路径保证同步）；旧文件布局不改，仅新增 DB 行。

**验收标准**
- 存量项目跑两遍 `index_volumes_chapters` 行数不变（幂等）；import 项目回填后 `GET /volumes` 立即可用。
- 孤儿章文件被占位卷承接；`index_status` 置 done 后重启不再重跑。
- 内嵌 word_count 恒 0 的存量被纠正为 `chapters/{ref}.yaml` 真字数。

**涉及文件**
- 新增：`client/backend/filesystem/index_volumes_chapters.py`
- 修改：`client/backend/main.py`（lifespan 挂载）、`client/backend/novels/router.py`（import_persist 调 reindex_project）

**依赖**：BE-01、BE-02

**估算**：L

**测试要求**：`tests/test_volume_chapter_index.py`（回填幂等跑两遍行数不变/孤儿章占位卷/import 项目回填/index_status run-once）→ 并入 BE-18 或本 todo 即时补。

---

### BE-04 · tier 门控旁路层 workflow/tier.py【特别标注：tier 门控旁路层（含 update_phase force）】（服务粒度）

**说明**
- 新建 `client/backend/workflow/tier.py`：
  - `tier_bypass(tier)`：**旁路条件 = 当前无付费权益**——`tier=="none"` **或 过期付费用户**（`check_permission().allowed == False`，BE P2-I），非裸 tier 字符串。
  - `tier_or_gate(db, project, gate_fn, *args)`：free 恒过，返回 `GateResult(valid=True, warnings=[], hard_block=False)`；PRO 走现状 `gate_fn(*args)`。读取 tier 用 `auth_local.service.check_permission()`。
  - `tier_phase_transition(project, phase)`：**free 下 `update_phase` 跳过 `can_transition` 校验（force 模式）**，PRO 走现状；统一收口，杜绝逐点修补（N9，免费归档 500 根因）。
- 接入点（`workflow/router.py` + `chapters/router.py`）：
  - `create_volume`：`gate_settings_complete` 走 `tier_or_gate`（现状 soft 不拦，收敛到统一路径）；
  - `confirm_chapter`：`gate_chapter_ready` 走 `tier_or_gate`（free 放行）；
  - `workflow/transition` 三个 hard gate 走 `tier_or_gate` + `update_phase` 走 `tier_phase_transition`；
  - `archive`：`update_phase("archive")` 走 `tier_phase_transition`（配合 BE-05）。
- `phase-status`（`workflow/router.py`）：free 追加 `tier_bypass: true` 且 phases 全 `complete`（不展示不催促，N14）；PRO 走现状 `get_phase_status`。
- **修复既有 bug**：`workflow/gates.py::gate_archived` 查 `.yaml` 但归档是 `.md`（B4）→ 改 DB 后从 `chapter_repo.count_archived(project_id)` COUNT（需 BE-01/BE-02；DB 表未就绪/回填未跑时 try/except 降级为现状文件扫描，不 500）。
- O3 维持：free 下 `current_phase` 仍幂等推进（UI 不展示、gate 不拦截）。

**验收标准**
- `tier=none`：confirm 无 memo/emotional_design/segments 也过；`workflow/transition` 全放行；`phase-status` 返回 `tier_bypass: true`。
- 过期付费（`allowed=False`）同样旁路；PRO（monthly/quarterly/yearly 未过期）全走现状 gate。
- free 归档不 500（配合 BE-05 后验证）。

**涉及文件**
- 新增：`client/backend/workflow/tier.py`
- 修改：`client/backend/workflow/router.py`、`client/backend/workflow/gates.py`（gate_archived）、`client/backend/chapters/router.py`（create_volume/confirm 接入点）

**依赖**：BE-01、BE-02（gate_archived 改 DB 需要；tier 旁路层本身可先行）

**估算**：L

**测试要求**：`tests/test_free_bypass.py`（tier=none confirm 无 memo 也过/transition 全放行/phase-status 带 tier_bypass/归档不 500）→ 并入 BE-18。

---

### BE-05 · 归档免费化 + AI 摘要降级（P0 核心）【特别标注：归档免费化 + AI 摘要降级】（端点粒度）

**说明**
- `archive/router.py`：`POST /chapters/{ref}/archive`、`GET /archives`、`GET /archives/{filename}` **移除 `require_ai_access`**（免费可读，共识「归档只读闭环」为免费能力）。
- `archive/service.py::archive_chapter`：
  - 写 `archives/vol-N-ch-M-{slug}.md`（现有逻辑）；
  - **AI 摘要降级**：`get_ai_client()` 抛 `ValueError`（未配 Key）或 `client.chat` 异常 → **捕获**，免费/无 Key 用 `full_text[:200]` 作 `archive_summary`（现状无 Key 抛 500，B2/D4）；有 Key 才调 AI 摘要；
  - YAML `archive_summary/archive_path/status='archived'` 照写。
- 归档调 `update_phase` 改走 `tier_phase_transition`（N9，免费归档不 500；`outline→archive` 在 free 下 force 通过）。
- DB 归档态写不在本 todo（见 BE-14）；本 todo 只保证**免费归档全流程无 AI 依赖、不 500**。

**验收标准**
- 无 API Key（`get_ai_client` 抛 ValueError）归档返回 200，摘要=正文前 200 字；`GET /archives` 与 `GET /archives/{filename}` 免费可读。
- 免费用户归档不 500（N9 显式验收）。

**涉及文件**
- 修改：`client/backend/archive/router.py`、`client/backend/archive/service.py`

**依赖**：BE-04

**估算**：M

**测试要求**：`tests/test_archive_free.py`（P0 部分：无 Key 归档摘要降级/免费可读/不 500）→ 并入 BE-18。

---

### BE-06 · VolumeService.list_volumes + create_volume（改 DB + MAX+1 + 双写）（服务粒度）

**说明**
- 新建 `client/backend/volumes/service.py`：
  - `list_volumes(db, project)`：**DB 查询**，`volume_repo.list_by_project` + `chapter_repo.list_by_project` 一次拉全、内存按 volume_id 分组（免 N+1），返回全量卷+章树元数据（`{ref,title,summary,chapter_count,chapters:[{ref,volume,chapter,title,status,word_count,has_prose,outline_status}]}`）；**不做正文过滤**（N1 过滤在前端）。
  - `create_volume(db, project, *, title, summary="")`：
    - gate 走 `tier_or_gate(db, project, gate_settings_complete)`（free 恒过）；
    - `volume_no = max_volume_no + 1`（**忽略/拒绝 `body.vol_num`**，B9/P2-N，防撞 UNIQUE）；
    - **双写（YAML 先写、DB 后更）**：`write_yaml(f"volumes/vol-{N}.yaml", {volume,title,summary,chapters_summary:[],chapters:[]})` → `db.add(Volume(...))` → `project.total_volumes += 1`（现状 `= vol_num` 覆盖式是 bug）→ `db.commit()`；
    - `update_phase(project, "outline")` 幂等（O3 下 free 也推进）。
- 改造 `chapters/router.py` 的 `GET /volumes`、`POST /volumes`（调用 service；也可迁出到 `volumes/router.py`，取决于评审——tech-backend 允许「迁出或原地改造」）。
- DB 写失败**降级不 500**：包 try/except + warning，YAML 已落，DB 行由读路径自愈（§4.4/§5-2）。

**验收标准**
- `GET /volumes` 返回 DB 树（含 has_prose/outline_status），不再文件扫描。
- `POST /volumes` 忽略 body.vol_num，卷号按 MAX+1；`total_volumes` 自增；free 下 gate 旁路。
- 双写失败降级不 500（mock repo 抛错验证）。

**涉及文件**
- 新增：`client/backend/volumes/__init__.py`、`client/backend/volumes/service.py`
- 修改：`client/backend/chapters/router.py`（GET/POST /volumes 接 service）

**依赖**：BE-02、BE-04

**估算**：L

**测试要求**：`tests/test_volume_chapter_crud.py`（create/list 双写一致、MAX+1）+ `tests/test_tree_db.py`（DB 树）→ 并入 BE-18。

---

### BE-07 · VolumeService.get/update/delete + {ref} 容 .yaml（端点粒度）

**说明**
- 新建 `client/backend/volumes/service.py`（续 BE-06）：
  - `get_volume(db, project, ref)`：`{ref}` 容 `.yaml` 尾缀（`strip_suffix(".yaml")`，旧前端 `vol-1.yaml` 调用零断裂）；DB 行元数据 + YAML 全字段（含 PRO outline 全字段）合并返回。
  - `update_volume(db, project, ref, body)`：body 拆两路——`title/summary` **双写 DB 行 + YAML**；其余 key（结构模板/核心冲突/情绪走向/信息差/冲突阶梯/场景卡）**只写 YAML**（PRO 全字段）；`data.pop("chapters", None)` **清派生快照**（§4.3 去重，消除双写源）。
  - `delete_volume(db, project, ref)`：删 DB 行（**CASCADE 删章行**）→ 删 `volumes/vol-N.yaml` + `chapters/vol-N-ch-*.yaml` + `versions/vol-N-ch-*/` + `archives/vol-N-*.md`；`project.total_volumes -= 1`、`project.total_chapters -= 删除章数`（同 session 同 commit）。
- 端点：`GET/PUT/DELETE /volumes/{ref}`（改造 `chapters/router.py` 原 `{filename}` 端点，路径参数名换 `ref` 兼容 `.yaml`）。
- 工具 `strip_suffix(ref, ".yaml")` 放 `workflow/engine.py` 或 `volumes/service.py`（一处定义复用）。

**验收标准**
- update `title/summary` 双写一致；PRO outline 字段只进 YAML 不污染 DB；`pop("chapters")` 后 YAML 内嵌列表清空。
- 删卷级联删章（DB CASCADE 生效）+ 删文件 + 计数正确；`vol-1` 与 `vol-1.yaml` 同寻址。

**涉及文件**
- 新增：`client/backend/volumes/service.py`（续）
- 修改：`client/backend/chapters/router.py`（GET/PUT/DELETE /volumes/{ref}）、`client/backend/workflow/engine.py`（strip_suffix）

**依赖**：BE-06

**估算**：L

**测试要求**：`tests/test_volume_chapter_crud.py`（update 双写/pop chapters/级联删卷删章/ref 容错）→ 并入 BE-18。

---

### BE-08 · ChapterService.create_chapter + POST /volumes/{ref}/chapters 替代【特别标注：POST /chapters breaking change】（端点粒度 + 迁移）

**说明**
- 新建 `client/backend/chapters/service.py`：
  - `create_chapter(db, project, volume_ref, title)`：
    - 经 `volume_repo.get_by_ref_or_number` 定位卷（容 `.yaml`）；
    - `chapter_no = max_chapter_no(project.id, vol.id) + 1`；`ref = f"vol-{vol.volume_no}-ch-{chapter_no}"`；
    - **双写（YAML 先写、DB 后更）**：写 `chapters/{ref}.yaml`（模板默认值，同现状 `chapters/router.py` 的 `create_chapter`）→ `db.add(Chapter(..., status="outline", word_count=0, has_prose=False, outline_status="unfilled"))` → `vol.chapter_count += 1`、`project.total_chapters += 1`（**同 session 同 commit**，防读改写竞态）；
    - **不再写 vol YAML 内嵌 chapters 列表**（§4.3 唯一属主非镜像）。
- **新增端点** `POST /api/novels/{id}/volumes/{ref}/chapters`（body `{title}`）。
- **旧端点** `POST /api/novels/{id}/chapters`（body `{volume, chapter}`）**移除/替代**——breaking change，**同 commit** 迁移：
  - `tests/test_readiness.py::_create_project_with_chapter`（`client.post(.../chapters, json={"volume":1,"chapter":1,...})`）；
  - `tests/test_workflow_api.py::_create_project_and_chapter`（同上）；
  - 前端 `client/frontend/src/pages/NovelPage.tsx:517` 的 `api.post(.../chapters, ...)`。
- `{ref}` 定位卷内建章，不再接受任意卷号/章号。

**验收标准**
- 新端点按卷定位建章、章号卷内自增；YAML 无内嵌列表残留；DB 行与文件一致。
- 旧 `POST /chapters` 移除后 `test_readiness.py`/`test_workflow_api.py` 迁移通过（同 commit）。

**涉及文件**
- 新增：`client/backend/chapters/service.py`
- 修改：`client/backend/chapters/router.py`（新端点 + 移除旧 POST /chapters）、`client/backend/tests/test_readiness.py`、`client/backend/tests/test_workflow_api.py`、`client/frontend/src/pages/NovelPage.tsx`

**依赖**：BE-02、BE-04

**估算**：M

**测试要求**：`tests/test_volume_chapter_crud.py`（建章 DB+YAML 一致/章号自增/内嵌列表不写）+ test_readiness/test_workflow_api 迁移 → 并入 BE-18。

---

### BE-09 · ChapterService.save_chapter/save_prose + refresh_chapter_meta（双写一致性核心）【特别标注：双写一致性（YAML 先写、DB 后更）】（服务粒度）

**说明**
- 续 `client/backend/chapters/service.py`：
  - `save_chapter(db, project, ref, data)`：`engine.save_chapter(root, ref, data)`（现状：YAML 写 + 版本快照，内容不变跳过）→ **`refresh_chapter_meta(db, project, ref, data)`**（双写第二步）。
  - `save_prose(db, project, ref, prose)`：读 YAML → `data["prose"]=prose` → `engine.save_chapter`（YAML + 版本快照）→ `refresh_chapter_meta`（编辑器自动保存专用；与 `save_chapter` 共用、互不干扰）。
  - **`refresh_chapter_meta(db, project, ref, data)`**：
    - DB 行缺失 → **懒补**（`ensure_volume_row` 前置，BE-02）；
    - **以重读 YAML 为准、只覆盖本次变更字段**（BE P1-C）——`row.title=data.get("title", row.title)`，word_count/has_prose 从重读 prose 算（`count_chars`，B5 口径），status/outline_status 从 YAML 派生（`confirmed→confirmed`；summary/task 非空→in_progress；否则 unfilled），**不整行覆盖 payload 缺省字段**；
    - **DB 失败降级不 500**：包 try/except + warning 日志（YAML 已落，DB 行由读路径自愈，§5-2）。
- 端点：`PUT /chapters/{ref}`（沿用 `engine.save_chapter` + `refresh_chapter_meta`）；**新增** `PUT /chapters/{ref}/prose`（body `{prose}`）。
- 并发：单用户 + SSE 多流 + 防抖保存；DB 元数据 update 同 session 串行 commit。

**验收标准**
- 保存正文后 DB `word_count/has_prose/outline_status/title` 正确，且以重读 YAML 为准；payload 缺省字段不被整行覆盖。
- DB 写抛错时接口仍返回 200（降级）+ 日志 warning，YAML 完整。

**涉及文件**
- 新增：`client/backend/chapters/service.py`（续）
- 修改：`client/backend/chapters/router.py`（PUT /chapters/{ref} + 新增 PUT .../prose）

**依赖**：BE-02、BE-08

**估算**：L

**测试要求**：`tests/test_dual_write.py`（save_chapter/save_prose 后 DB 元数据正确/以 YAML 为准/DB 失败降级）→ 并入 BE-18。

---

### BE-10 · GET /chapters/{ref} 合并 DB 元数据 + 读路径自愈【特别标注：ensure_volume_row 懒补】（端点粒度）

**说明**
- 改造 `chapters/router.py::get_chapter`：
  - YAML 内容 + DB 元数据（`word_count/outline_status/status/confirmed_at/archived_at`）**合并返回**（DB 为准；YAML 缺失则回填）；
  - **DB 行缺失 → 读路径自愈**：`ensure_volume_row`（BE-02，先 upsert 卷行再插章行）→ 懒补章行（从 YAML 反解插入），不 500（B10/P1-D 读路径自愈收口）。
- `GET /volumes/{ref}` 的 DB 行缺失同样走 `ensure_volume_row` 自愈（若 BE-07 未覆盖，此处统一）。

**验收标准**
- GET 返回含 DB 元数据字段；DB 行被手工删后 GET 一次自愈重建（卷行 + 章行），再查稳定。

**涉及文件**
- 修改：`client/backend/chapters/router.py`、`client/backend/repositories/chapter_repo.py`（懒补 helper）

**依赖**：BE-02、BE-08

**估算**：M

**测试要求**：`tests/test_dual_write.py` / `tests/test_volume_chapter_crud.py`（懒补自愈）→ 并入 BE-18。

---

### BE-11 · confirm_chapter（tier_or_gate + DB 状态写 + 不写内嵌列表）（端点粒度）

**说明**
- 改造 `chapters/router.py::confirm_chapter`：
  - `gate_chapter_ready` 走 `tier_or_gate(db, project, gate_chapter_ready, chapter)`（free 放行，BE-04）；
  - 写 YAML `status='confirmed'` → DB `row.status='confirmed'`/`row.outline_status='confirmed'`/`row.confirmed_at=now`（同 session commit）；
  - **不再写 vol YAML 内嵌列表**（现状 `router.py:270-284` 删除）。
- DB 行缺失 → `ensure_volume_row` 懒补前置（BE-02/BE-10）。

**验收标准**
- free 下无 memo/segments 也 confirm 通过；DB confirmed 态（status/outline_status/confirmed_at）正确；YAML 内嵌列表不被改写。

**涉及文件**
- 修改：`client/backend/chapters/router.py`、`client/backend/chapters/service.py`

**依赖**：BE-04、BE-08

**估算**：S

**测试要求**：`tests/test_free_bypass.py`（free confirm 放行）+ `tests/test_volume_chapter_crud.py`（confirmed DB 态）→ 并入 BE-18。

---

### BE-12 · delete_chapter（级联清理 + 计数维护）（端点粒度）

**说明**
- 改造 `chapters/router.py::delete_chapter`：
  - 删 `chapters/{ref}.yaml` → `chapter_repo.delete`（DB 行）→ 删 `versions/{ref}/`；`vol.chapter_count -= 1`、`project.total_chapters -= 1`（同 session commit）；
  - **不再改 vol YAML 内嵌列表**（现状 `router.py:200-214` 删除）。

**验收标准**
- 删章后文件/DB 行/versions 全清 + 计数正确 + 树无残留；内嵌列表不被改写。

**涉及文件**
- 修改：`client/backend/chapters/router.py`、`client/backend/chapters/service.py`

**依赖**：BE-02、BE-08

**估算**：S

**测试要求**：`tests/test_volume_chapter_crud.py`（删除清理 + 计数）→ 并入 BE-18。

---

### BE-13 · versions restore 后刷新 DB 元数据（端点粒度）

**说明**
- `chapters/versions.py::restore_version`：`save_chapter` 后追加一次 `refresh_chapter_meta`（正文变了字数变，word_count/has_prose/status/outline_status/confirmed_at 刷新，BE P2-H）。

**验收标准**
- restore 后 DB word_count/has_prose 与恢复出的 YAML 一致。

**涉及文件**
- 修改：`client/backend/chapters/versions.py`

**依赖**：BE-09

**估算**：S

**测试要求**：`tests/test_dual_write.py`（restore 后元数据刷新）→ 并入 BE-18。

---

### BE-14 · archive DB 双写 + unarchive 端点（P2, N6）（端点粒度）

**说明**
- `archive/service.py::archive_chapter` 补 DB 归档态写（续 BE-05）：`row.status='archived'`/`row.archived_at=now`/`row.has_prose=True`（DB 行缺失 → `ensure_volume_row` 懒补前置，BE-02/BE-10）；YAML `status='archived'` 照写。
- **新增 `POST /chapters/{ref}/unarchive`**（N6，P2）：YAML `status` 回退（`archived`→ 原态/`draft`）+ DB `status` 回退 + `archived_at` 清空；`GET /archives` 同步过滤已 unarchive 项（前端「取消归档，继续编辑」数据源）。

**验收标准**
- 归档后 DB `status='archived'/archived_at/has_prose=True`；unarchive 后只读解除、树/归档列表同步；免费可用（无 require_ai_access）。

**涉及文件**
- 修改：`client/backend/archive/service.py`、`client/backend/archive/router.py`

**依赖**：BE-02、BE-05、BE-10

**估算**：M

**测试要求**：`tests/test_archive_free.py`（P2 部分：归档态写 DB/unarchive）→ 并入 BE-18。

---

### BE-15 · GET /volumes 全量树 + build_project_tree 改 DB + breaking change 迁移【特别标注：GET /volumes 改 DB breaking change】（端点粒度 + 迁移）

**说明**
- **`GET /api/novels/{id}/volumes`** 由文件扫描改为 **DB 查询**（BE-06 已实现 `list_volumes` 服务层）：返回**全量卷+章树元数据**（含 `has_prose/archived/outline_status`），**不做正文过滤**（N1/BE P1-E，过滤在前端基于 `has_prose`）——**breaking change，同 commit 迁移前端**：
  - `client/frontend/src/pages/NovelPage.tsx::loadVolumes`（现读 `v.filename`/`v.name`/逐卷读 YAML 组树）改为直接消费 DB 树响应（`{volumes:[{ref,title,summary,chapter_count,chapters:[{ref,volume,chapter,title,status,word_count,has_prose,outline_status}]}]}`）；
  - `VolumeEditor`/`useOutline` 的 `VolumeEntry` 类型向后兼容：`has_prose`/`archived` 字段可选 + `??` 兜底。
- **`novels/service.py::build_project_tree`（`GET /tree`）改写为 DB 查询**：返回结构保持 `{project_id, volumes:[{ref,title,summary,chapter_count,chapters:[...]}]}`，前端 `useOutline.refetchTree` **零改动**（BE P1-A）；word_count 改 `count_chars` 口径（B5）。
- 同 commit 迁移清单（N11）：前端 `NovelPage.loadVolumes` + `useOutline` 兜底 + 相关 E2E。

**验收标准**
- `GET /volumes` 返回 DB 树（全量含 has_prose/archived），不文件扫描、无正文过滤；`GET /tree` 结构不变、前端 useOutline 零改动。
- breaking change 同 commit 迁移后前端主流程（树 CRUD/写作）正常。

**涉及文件**
- 修改：`client/backend/novels/service.py`（build_project_tree 改 DB）、`client/backend/chapters/router.py`（GET /volumes 接 DB service）
- 前端（同 commit）：`client/frontend/src/pages/NovelPage.tsx`、`client/frontend/src/hooks/useOutline.ts`、`client/frontend/src/components/novel/VolumeEditor.tsx`

**依赖**：BE-06、BE-08

**估算**：L

**测试要求**：`tests/test_tree_db.py`（GET /volumes DB 树 + has_prose + 全量不过滤）+ `test_readiness.py`/`test_workflow_api.py` 迁移（BE-08 已含）→ 并入 BE-18。

---

### BE-16 · write/_stream_chapter 补 refresh（N10）+ novel_to_dict 补 type/genre（端点粒度）

**说明**
- `write/router.py::_stream_chapter`：AI 流式写 YAML 完成（`is_done` 分支）后补一次 `refresh_chapter_meta`（N10，P1 落库后 PRO AI 写作字数/状态不陈旧）。
- `novels/service.py::novel_to_dict`：补 `type/genre` 展示字段（NovelBar 类型位数据源，FE 2.2-6；或前端从 genre 设定派生——二选一，默认后端返回 `genre`，成本低）。

**验收标准**
- AI 流式写完 `GET /volumes`/`GET /chapters` 的 word_count/has_prose 不陈旧；`GET /novels` 返回含 genre。

**涉及文件**
- 修改：`client/backend/write/router.py`、`client/backend/novels/service.py`

**依赖**：BE-09

**估算**：S

**测试要求**：`tests/test_dual_write.py`（N10 部分）→ 并入 BE-18。

---

### BE-17 · settings/ai_router.generate_field 补挂 require_ai_access（D5）（端点粒度）

**说明**
- `settings/ai_router.py::generate_field`（`POST /settings/ai/{type}/{field}`）**补挂** `_: bool = Depends(require_ai_access)`（现状漏 import 未挂，免费可绕过，G3 端点级校验）。
- `generate_all_settings`（`POST /settings/generate`）已挂，不动。
- P3 再把 `require_ai_access` 语义从「有无 API Key」改为「tier 是否 PRO」——本次不做（占位已满足「免费直呼 AI 端点 403」）。

**验收标准**
- 无 Key/免费过期直呼 `generate_field` 返回 403/503 门控，而非 500/绕过。

**涉及文件**
- 修改：`client/backend/settings/ai_router.py`

**依赖**：无（独立小修）

**估算**：S

**测试要求**：`tests/test_settings_ai.py` 补一条（未配 Key → 403/503）。

---

### BE-18 · 后端测试套件（测试粒度）

**说明**
- 新增测试（对齐现有 pytest 风格：mock `get_storage`/临时 DATA_ROOT/TestClient + `dependency_overrides`，参照 `test_workflow_api.py`）：

| 文件 | 覆盖 |
| --- | --- |
| `tests/test_volume_chapter_index.py` | 回填幂等（跑两遍行数不变）、孤儿章文件建占位卷、import 项目回填、`index_status` run-once |
| `tests/test_dual_write.py` | save_chapter/save_prose 后 DB word_count/has_prose/outline_status 正确；YAML 内容准；refresh 以 YAML 为准；DB 失败降级；versions restore 刷新 |
| `tests/test_volume_chapter_crud.py` | 卷/章 CRUD 的 DB+YAML 一致性、卷内章号自增、`MAX(volume_no)+1`、级联删卷删章、计数维护、{ref} 容 .yaml |
| `tests/test_free_bypass.py` | tier=none：confirm 无 memo 也过、transition 全放行、phase-status 带 tier_bypass、归档不 500（N9）；过期付费旁路 |
| `tests/test_archive_free.py` | 无 Key 归档（摘要降级 200 字）、归档态写 DB、GET /archives 免费可读、unarchive（N6） |
| `tests/test_tree_db.py` | GET /volumes 返回 DB 树（含 has_prose/outline_status）、全量不过滤、build_project_tree 结构不变 |
| `tests/test_readiness.py`/`tests/test_workflow_api.py` | 迁移：`POST /chapters` → `POST /volumes/{ref}/chapters`（BE-08 同 commit） |

- 验收口径对齐 `development-plan.md` §8 P1：卷/章元数据入 DB + 回填幂等 + 双写 + breaking change 迁移 + 测试套件全绿。

**验收标准**
- 新增 6 套件全绿；现有 66 测试不回归（`python -m pytest tests/ -v`）。

**涉及文件**
- 新增：`client/backend/tests/test_volume_chapter_index.py`、`test_dual_write.py`、`test_volume_chapter_crud.py`、`test_free_bypass.py`、`test_archive_free.py`、`test_tree_db.py`
- 修改：`client/backend/tests/test_readiness.py`、`test_workflow_api.py`、`test_settings_ai.py`

**依赖**：BE-03~BE-17 全部

**估算**：L

**测试要求**：本身即测试；以 `cd client/backend && python -m pytest tests/ -v` 全绿为验收。

---

## 3. 关键实现约定（跨 todo 通用）

1. **双写一致性（G1 最大风险）**：一律「YAML 先写、DB 后更、以 YAML 为内容准、以 DB 为结构准」；DB 写失败**降级不 500**（try/except + warning），DB 行由读路径自愈（BE-10）与启动回填（BE-03）兜底；写路径**不再维护 `vol-N.yaml` 内嵌 chapters 列表**（§4.3，唯一属主非镜像）。
2. **懒补收口**：`ensure_volume_row`（BE-02）先 upsert 卷行再插章行，所有 DB 行缺失场景（save/confirm/archive/get）统一走它。
3. **计数与插行同事务**：`chapter_count/total_chapters` 的 `+=1` 与插章行同 session 同 commit（防读改写竞态）。
4. **word_count 口径**：全后端统一 `count_chars`（去空白，BE-02），与前端 `countChars` 一致（B5）。
5. **`{ref}` 容 `.yaml` 尾缀**：卷/章路由对 `vol-1.yaml`/`vol-1-ch-1.yaml` 容错（`strip_suffix`），旧调用零断裂。
6. **tier 旁路语义**：旁路条件 = 无付费权益（`tier=="none"` 或过期付费 `allowed==False`），非裸 tier 字符串；PRO 全走现状 gate；O3 下 free 的 `current_phase` 仍幂等推进。
7. **breaking change 同 commit**：`GET /volumes` 响应形状、`POST /chapters` 替代必须与前端 + 测试同 commit（N11），禁止跨 commit 悬空。

## 4. 范围外（本次不做）

- P3 PRO 解锁逻辑：`require_ai_access` 语义改「tier 是否 PRO」、AI 生成正文解锁、提示词面板 UI。
- 导入导出、多端同步；免费限 1 本机制（O1 只改文案显式化，后端 `require_project_limit` 不动）。
- C 端 Alembic 引入（tech-backend §4.1 为「可选硬化」，本次先靠 create_all + 幂等回填跑通；如需引入列为 P1 待办可选，不默认纳入）。
