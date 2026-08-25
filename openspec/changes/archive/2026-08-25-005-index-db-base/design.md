# 005-index-db-base — Design

## 架构总览

```
main.py lifespan                        novels/router.py::import_persist
  └─ Base.metadata.create_all           └─ await reindex_project(project_id)
  └─ ALTER projects ADD index_status
  └─ index_volumes_chapters()  ────────────────┐
                                                │
filesystem/index_volumes_chapters.py            │
  └─ _all_project_root_paths()  (migrate.py 复用)│
  └─ _scan_project(root)  ── 核心扫描，per-project 共用 ──┐
        ├─ volumes/vol-N.yaml ──→ volume_repo.upsert     │
        ├─ chapters/{ref}.yaml ──→ chapter_repo.upsert   │
        └─ 自愈：project.total_volumes / total_chapters  │
                                                │
repositories/{volume_repo,chapter_repo}.py      │
  └─ ensure_volume_row  ── 懒补收口（change 006 复用）
novels/service.py
  └─ count_chars  ── 去空白中文口径（前端 countChars 同）
```

- **只做底座，行为零变化**：所有业务端点（`GET /volumes`、树、归档）本 change **仍走文件**；DB 行只建不读，change 006 才切换双写。
- **幂等回填 run-once**：`project.index_status != "done"` 才跑，跑完置 done；判据 + INSERT-if-missing 双保险。
- **per-project 强制重扫**：`reindex_project(project_id)` 供 import 场景，不受 index_status 限制。

## 数据模型

### `models/volume.py` → `Volume`
```python
class Volume(Base):
    __tablename__ = "volumes"
    __table_args__ = (UniqueConstraint("project_id", "volume_no", name="uq_volumes_project_volume_no"),)
    id = Column(String(36), primary_key=True, default=uuid4_str)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    volume_no = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=False, default="")
    chapter_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    chapters = relationship("Chapter", cascade="all, delete-orphan", back_populates="volume")
```
- `uuid4_str = lambda: str(uuid.uuid4())`（models 现有模式，若已有工具函数则复用）。

### `models/chapter.py` → `Chapter`
```python
class Chapter(Base):
    __tablename__ = "chapters"
    __table_args__ = (
        UniqueConstraint("project_id", "ref", name="uq_chapters_project_ref"),
        Index("ix_chapters_project_volume_status", "project_id", "volume_id", "status"),
    )
    id = Column(String(36), primary_key=True, default=uuid4_str)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    volume_id = Column(String(36), ForeignKey("volumes.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_no = Column(Integer, nullable=False)
    ref = Column(String(64), nullable=False)
    title = Column(String(200), nullable=False)
    status = Column(String(20), nullable=False, default="outline")
    word_count = Column(Integer, nullable=False, default=0)
    has_prose = Column(Boolean, nullable=False, default=False)
    outline_status = Column(String(20), nullable=False, default="unfilled")
    confirmed_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```
- `volume_id` FK `ondelete="CASCADE"` + ORM relationship `cascade="all, delete-orphan"` 双保险；db.py 已 `PRAGMA foreign_keys=ON`，级联真生效。
- `confirmed_at`：status=='confirmed' 时回填；`archived_at`：归档时回填（本 change 只建行，值由回填/后续写路径填）。

### `models/project.py` 增量
```python
index_status = Column(String(20), nullable=False, default="none")  # none/done
volumes = relationship("Volume", cascade="all, delete-orphan", back_populates="project")
```
- 存量库经 `main.py` lifespan `ALTER TABLE projects ADD COLUMN index_status TEXT DEFAULT 'none'`（同 `source`/`backfill_status` 模式，try/except 幂等）。

### `models/__init__.py`
- `from .volume import Volume`、`from .chapter import Chapter` → `Base.metadata.create_all` 启动即建表。

## 查询层（repositories，纯 DB 查询，不进业务路由）

### `repositories/volume_repo.py`
- `list_by_project(db, project_id)` → `db.scalars(select(Volume).where(...).order_by(Volume.volume_no))`。
- `get_by_ref_or_number(db, project_id, ref_or_no)`：剥 `.yaml` 尾缀 → `"vol-N"` → int(N)；同时试 `get_by_volume_no`。
- `get_by_volume_no` / `max_volume_no`（无行返 0）/ `count_by_project`。
- `upsert(db, project_id, volume_no, *, title, summary="")`：按 UNIQUE 找，缺则 `add` + `flush`（不 commit，交给调用方事务）。
- `ensure_volume_row(db, project_id, volume_no, *, title=None)`：卷行缺失 → upsert 卷（title 兜底「导入卷 N」）；返回 Volume。

### `repositories/chapter_repo.py`
- `list_by_project(db, project_id)`：一次性 `select(Chapter).where(project_id)`（内存分组免 N+1）。
- `get_by_ref` / `has` / `upsert`（全部字段）/ `delete(chapter_id)` / `max_chapter_no` / `count_by_project` / `count_archived`（status=='archived'）。
- upsert 内 `has_prose = bool(prose and prose.strip())`、`outline_status` 派生（见回填）。

### `count_chars`（novels/service.py）
```python
def count_chars(text: str) -> int:
    return len(re.sub(r"\s+", "", text or ""))
```
- 与前端 `countChars`（`text.replace(/\s/g, "").length`）同口径；本 change 仅回填用，change 006 起 save_prose/树共用。

## 幂等回填

### `filesystem/index_volumes_chapters.py`

```python
def index_volumes_chapters() -> None:
    for root in _all_project_root_paths():
        try:
            _scan_project(root)
        except Exception:
            logger.warning("index volumes/chapters failed for %s", root, exc_info=True)

def reindex_project(project_id: str) -> None:
    # 强制重扫（不受 index_status 限制），供 import_persist 调用
```

- `_all_project_root_paths()`：复用 `filesystem/migrate.py` 的枚举模式（`select(Novel.root_path)`），含 import 项目。
- `_scan_project(root)`：
  1. `project = select(Novel).where(Novel.root_path == root)`。
  2. 若 `index_status == "done"` 且非强制 → return。
  3. 遍历 `volumes/vol-N.yaml`：
     - `vol_no = int(stem.split("-")[1])`。
     - `volume_repo.upsert`（title 取 YAML `title`，缺省「导入卷 N」）。
     - 内嵌 `chapters` 列表（`chapters` 可能缺省/None）→ `ref=f"vol-{vol_no}-ch-{chapter}"`：
       - 读 `chapters/{ref}.yaml`（可能缺）：
         - **以章 YAML 为准**：`title`（章 YAML 优先，退内嵌）、`status`、`prose` → `word_count=count_chars(prose)`、`has_prose=bool(prose.strip())`、`outline_status`（status=='confirmed'→'confirmed'；prose 非空→'in_progress'；否则 'unfilled'）。
         - 卷内引用但无章文件 → 占位章行（title 取内嵌项，word_count=0）。
       - `chapter_repo.upsert`（INSERT-if-missing 双保险）。
  4. **孤儿章文件兜底**：`list_dir(root, "chapters")` 中 `vol-*-ch-*.yaml` 且 DB 无行 → 反查 `volume_no`（`get_by_volume_no` 无则先建占位卷）+ upsert 章行。
  5. **自愈冗余计数**：`project.total_volumes=count_by_project`、`project.total_chapters=count_by_project(chapters)`。
  6. 跑完置 `index_status = "done"`（reindex_project 也置 done），`db.commit()`。
  7. **只增不删**：文件已删的孤儿 DB 行不清理。
- ref 解析复用 `workflow/engine._validate_ref` 的拆分逻辑（`split("-")` → vol=parts[1], ch=parts[3]）。

### `main.py` lifespan 挂载
- settings migrate 之后、tone backfill 附近：`index_volumes_chapters()`，包 try/except + `logger.warning`，不阻塞启动。
- 加列 ALTER 与其他 ALTER 并列。

### `novels/router.py::import_persist`
- 写完 YAML + 建项目记录 commit 后：`await reindex_project(project_id)` → 导入即列表可用。
- 需确认 import_persist 当前签名/事务结构，若 DB session 可用则直接复用；reindex_project 设计为同步函数，在 async 中 `run_in_executor` 或直接调用（扫描逻辑为 sync 文件 I/O + SQLAlchemy sync session 模式需对齐现有 async 模式——**以现有 filesystem 模块 sync 约定为准**）。

## 测试（TE-06 / TE-07 → `tests/test_volume_chapter_index.py`）

- TE-06 建表：fixture（临时 DATA_ROOT + create_all）后断言 `volumes`/`chapters` 表存在、字段类型、UNIQUE/INDEX 约束；`projects.index_status` 列存在。
- TE-07 幂等回填：
  - 构造存量项目目录（vol-1.yaml 内嵌 chapters + chapters/vol-1-ch-1.yaml）→ 跑 `_scan_project` 两遍 → 行数不变。
  - 内嵌 word_count=0 但章文件有 prose → 真字数/`has_prose=True`。
  - 孤儿章文件 → 占位卷 + 章行。
  - `index_status='done'` 后 `_scan_project` 不重扫（行数不变 + 不新增）。
  - `count_chars("  你好 世界 \n abc") == 7`。
  - `ensure_volume_row` 卷行缺失 + 章行缺失一次补全。
- conftest 建表基座自动兼容；既有 280 测试零回归。

## 风险与取舍

- **行为零变化**：本 change 无业务端点改动，DB 行只建不读 → 回归风险最低；change 006 才在写路径双写，007 才切读。
- **回填读文件成本**：启动遍历所有项目根目录扫描 YAML；项目少（单用户桌面），可接受；try/except 防单项目失败阻塞启动。
- **word_count 可信源**：内嵌列表 word_count 恒 0 的存量以 `chapters/{ref}.yaml` 为准（现状前端存 prose 于章文件）。
- **不删孤儿 DB 行**：避免文件新写路径删除导致的行清理竞态；后续写路径负责一致性。
