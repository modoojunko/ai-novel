# 卷/章数据底座 — Tasks

> BE-01 / BE-02 / BE-03 ｜ TE-06 / TE-07

## 能力 volume-chapter-index

### BE-01 模型 + 建表（data models）

- [ ] `models/volume.py`（新）：`Volume` 全字段 + UNIQUE(project_id, volume_no) + `chapters` relationship(cascade="all, delete-orphan")
- [ ] `models/chapter.py`（新）：`Chapter` 全字段 + UNIQUE(project_id, ref) + INDEX(project_id, volume_id, status) + `volume_id` FK ondelete CASCADE
- [ ] `models/project.py`（改）：`index_status` 列（String(20) default "none"）+ `volumes` relationship
- [ ] `models/__init__.py`（改）：注册 Volume/Chapter
- [ ] `main.py`（改）：lifespan `ALTER TABLE projects ADD COLUMN index_status TEXT DEFAULT 'none'`（幂等 try/except）；`create_all` 自动含新表

### BE-02 repositories + count_chars（query layer）

- [ ] `repositories/__init__.py`（新）
- [ ] `repositories/volume_repo.py`（新）：list_by_project / get_by_ref_or_number / get_by_volume_no / max_volume_no / upsert / count_by_project / **ensure_volume_row**
- [ ] `repositories/chapter_repo.py`（新）：list_by_project / get_by_ref / has / upsert / delete / max_chapter_no / count_by_project / count_archived
- [ ] `novels/service.py`（改）：`count_chars`（去空白中文口径）

### BE-03 幂等回填（backfill + 挂载）

- [ ] `filesystem/index_volumes_chapters.py`（新）：`index_volumes_chapters()` / `reindex_project(project_id)` / `_scan_project(root)`（复用 migrate 枚举 + _validate_ref 拆分）
- [ ] `main.py`（改）：lifespan 挂载 `index_volumes_chapters()`（settings migrate 之后、try/except + warning 不阻塞启动）
- [ ] `novels/router.py`（改）：`import_persist` 写 YAML + 建记录后调 `reindex_project(project_id)`

## 测试（TE-06 / TE-07）

- [ ] `tests/test_volume_chapter_index.py`（新）：建表字段/约束/索引存在；`count_chars("  你好 世界 \n abc")==7`；`ensure_volume_row` 缺行一次补全；回填跑两遍行数不变（幂等）；内嵌 word_count=0 被章 YAML 真字数纠正；孤儿章占位卷；`index_status='done'` 后不重扫；既有 280 零回归

## 验收

- [ ] `cd client/backend && .venv/bin/python -m pytest tests/test_volume_chapter_index.py -v` 全绿
- [ ] `cd client/backend && .venv/bin/python -m pytest tests/ -v` 全量全绿（新增 + 既有 280 零回归）
- [ ] 启动（或 conftest fixture）自动建表：`volumes`/`chapters` 存在，`projects.index_status` 列存在（存量库 ALTER 不报错）
- [ ] 回填跑两遍行数不变；import 项目 reindex_project 即列表可用
