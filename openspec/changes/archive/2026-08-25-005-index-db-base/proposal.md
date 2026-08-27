# 卷/章数据底座（005-index-db-base）

## Why

P1 数据底座是 P0 断点 1 完整验收的**真实数据源前置**（sprint-plan §3）：N1 空章弱化、字数/归档徽标、进度条都依赖**可查询的卷/章元数据**，而当前这些信息只能从 `volumes/vol-N.yaml` 内嵌列表或 `chapters/*.yaml` 逐文件读取：

- **无卷/章元数据表**：`GET /volumes` 只能拼文件列表，`has_prose`/字数/归档态无法高效聚合；`build_project_tree` 需 N+1 读文件。
- **无字数统一口径**：后端各路径手工 `len(text)` 去不去空白不一致，与前端 `countChars`（去空白中文）口径漂移。
- **无幂等回填**：存量项目（含 import 项目）的卷/章从未入 DB，双写落地前没有一次性底座。
- **无懒补收口**：后续双写（change 006）的 `ensure_volume_row` 需要一个统一入口，先建好以便 BE-06~BE-13 复用。

本 change 只做**底座**：建表 + 查询层 + 幂等回填，不改任何业务端点行为（`GET /volumes` 等仍走文件），`change 006` 才切换双写。这样底座先行、行为零变化，风险隔离。

## What Changes

### 能力 `volume-chapter-index`（BE-01 / BE-02 / BE-03）

1. **数据表**（development-plan §5.1/§5.2 严格对齐）：
   - `models/volume.py` → `Volume`：`id`(PK uuid4)/`project_id`(FK→projects.id NOT NULL INDEX)/`volume_no`(NOT NULL)/`title`(String200 NOT NULL)/`summary`(Text default '')/`chapter_count`(Int default 0)/`created_at`/`updated_at`；**UNIQUE(project_id, volume_no)**；`chapters = relationship(cascade="all, delete-orphan")`。
   - `models/chapter.py` → `Chapter`：`id`(PK)/`project_id`(FK)/`volume_id`(FK→volumes.id **ON DELETE CASCADE** + ORM cascade 双保险)/`chapter_no`/`ref`(**UNIQUE(project_id, ref)**)/`title`/`status`(default 'outline')/`word_count`(default 0)/`has_prose`(default False)/`outline_status`(default 'unfilled')/`confirmed_at`/`archived_at`/`created_at`/`updated_at`；**INDEX(project_id, volume_id, status)**。
   - `models/project.py`：加 `index_status` 列（String(20) default "none"，lifespan 里 `ALTER TABLE projects ADD COLUMN index_status TEXT DEFAULT 'none'`，同 `source`/`backfill_status` 模式）+ `volumes = relationship(...)`。
   - `models/__init__.py` 注册 Volume/Chapter → `main.py` lifespan `Base.metadata.create_all` 启动即建表（conftest 自动兼容）。

2. **查询层**：
   - `repositories/volume_repo.py`：`list_by_project`(ORDER BY volume_no)/`get_by_ref_or_number`(容 `.yaml` 尾缀)/`get_by_volume_no`/`max_volume_no`/`upsert`/`count_by_project`。
   - `repositories/chapter_repo.py`：`list_by_project`(一次性拉全)/`get_by_ref`/`has`/`upsert`/`delete`/`max_chapter_no`/`count_by_project`/`count_archived`(gate_archived 用)。
   - **`ensure_volume_row(db, project_id, volume_no)`**（懒补统一收口）：卷行缺失先 upsert 卷（title 取 YAML 或「导入卷 N」）再插章行，放 `volume_repo.py`。
   - **`count_chars(text)`**（B5 同口径）：`re.sub(r"\s+", "", text)` 后 `len`，放 `novels/service.py`，供 save_prose/树/novel_to_dict 共用。

3. **幂等回填** `filesystem/index_volumes_chapters.py`：
   - `index_volumes_chapters()`：遍历 `_all_project_root_paths()`（复用 migrate.py 枚举模式）；扫描 `volumes/vol-N.yaml` 卷行缺失才 INSERT-if-missing；内嵌 chapters 列表 → `ref=f"vol-{vol_no}-ch-{chapter}"`，**以 `chapters/{ref}.yaml` 为准**（内嵌 word_count 不可信）读 YAML 取 title/status/prose → `word_count=count_chars(prose)`、`has_prose=bool(prose.strip())`、`outline_status` 派生；卷内引用但无章文件 → 占位章行（word_count=0）。
   - **孤儿章文件兜底**：扫描 `chapters/*.yaml` 中 DB 无行且无对应卷行 → 反查 volume_no 建占位卷 + 章。
   - **自愈冗余计数**：`project.total_volumes=COUNT(volumes)`、`project.total_chapters=COUNT(chapters)`。
   - **run-once**：`project.index_status != "done"` 才跑，跑完置 done（判据 + INSERT-if-missing 双保险，重启幂等）。
   - `reindex_project(project_id)`：per-project 变体，供 `import_persist` 调用。
   - `main.py` lifespan 挂载（settings migrate 之后、tone backfill 附近；try/except + warning 不阻塞启动）；`novels/router.py::import_persist` 写 YAML + 建记录后调 `reindex_project`。
   - **只增不删**：文件被新写路径删除的孤儿 DB 行不清理；旧文件布局不改。

## Impact

- 后端新增：`models/volume.py`、`models/chapter.py`、`repositories/{__init__,volume_repo,chapter_repo}.py`、`filesystem/index_volumes_chapters.py`。
- 后端修改：`models/__init__.py`（注册）、`models/project.py`（index_status + relationship）、`main.py`（lifespan 挂载回填 + ALTER 加列）、`novels/service.py`（count_chars）、`novels/router.py`（import_persist 调 reindex_project）。
- 测试：TE-06（模型/建表）、TE-07（幂等回填）→ 新增 `tests/test_volume_chapter_index.py`；`tests/conftest.py` 建表基座自动兼容，现有 280 测试零回归。
- 兼容：业务端点行为零变化；`GET /volumes` 等仍走文件；`index_status` 列加列对存量库 ALTER 幂等。

## Rollout

1. BE-01 模型 + 建表 → conftest 自动建表验证
2. BE-02 repositories + ensure_volume_row + count_chars
3. BE-03 幂等回填 + lifespan 挂载 + import reindex
4. TE-06/TE-07 测试 → `python -m pytest tests/ -v` 全绿（新增 + 既有 280）
