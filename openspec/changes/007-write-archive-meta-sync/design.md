# 007-write-archive-meta-sync — Design

## 架构总览

```
write/router.py                              archive/router.py
  POST /write     → _stream_chapter(+db,project)   POST /archive → refresh DB 章行 archived
  POST /continue  → stream_continue(+db,project)     POST /chapters/{ref}/unarchive（新）
                                                    novels/router.py
  write/auxiliary.py                                  GET /novels/{id} → 合并 genre KV
    stream_continue: is_done 后 refresh_chapter_meta
```

- 写/归档路径与 change 006 读路径一致：**YAML 先写、DB 后更、以 YAML 为内容准、以 DB 为结构准**；DB 失败降级不 500（读路径自愈兜底）。
- 复用 `chapters.service.refresh_chapter_meta`（change 006 收口，ensure_volume_row 懒补 + 重读 YAML 为准）。
- archive 停写内嵌列表：删 `archive/service.py` 的「同步卷章列表状态」块（§4.3 唯一属主非镜像）；树读已切 DB，DB 行 archived 即树 📦。

## 关键实现点

### 1. `write/router.py::write_chapter` → `_stream_chapter(db, project, ...)`

```python
return StreamingResponse(
    _stream_chapter(db, project, project.root_path, chapter_ref, ctx, prompt), ...
)
```
`_stream_chapter` 签名加 `db, project`；`is_done` 分支写完 YAML 后：
```python
from chapters.service import refresh_chapter_meta
await refresh_chapter_meta(db, project, chapter_ref, chapter)
```

### 2. `write/router.py::continue_writing` → `stream_continue(db, project, ...)`

透传 `db, project`；`write/auxiliary.py::stream_continue` 签名加 `db, project`，`is_done` 保存后 `refresh_chapter_meta(db, project, chapter_ref, chapter)`。

### 3. `archive/service.py::archive_chapter` 删内嵌列表块 + `archive/router.py` DB 同步

- `archive/service.py` 删除 lines 62-70（vol YAML 内嵌 chapters status 更新）。
- `archive/router.py::archive` 在 `archive_chapter` 后：
  ```python
  from chapters.service import refresh_chapter_meta
  await refresh_chapter_meta(db, project, chapter_ref)  # 读 YAML → status=archived
  try:
      from repositories import chapter_repo
      row = await chapter_repo.get_by_ref(db, project.id, chapter_ref)
      if row is not None:
          row.status = "archived"
          row.archived_at = datetime.now(UTC).replace(tzinfo=None)
      await db.commit()
  except Exception:
      pass  # DB 失败不 500
  ```
  `refresh_chapter_meta` 会把 YAML 的 `status='archived'` 派生进 DB；显式置 `archived_at` 是唯一 DB-only 字段。

### 4. `GET /novels/{id}` 补 genre

`novels/router.py` 详情端点：`novel_to_dict(project)` 后，读 `project_settings` KV：
```python
from sqlalchemy import select
from models.project_setting import ProjectSetting
row = await db.execute(select(ProjectSetting).where(
    ProjectSetting.root_path == project.root_path, ProjectSetting.key == "genre"))
cfg = json.loads(row.scalar_one_or_none().content) if row.scalar_one_or_none() else {}
data["genre"] = cfg.get("genre_id")
data["genre_name"] = <题材名，查 genres 表；题材已删则 None>
```
try/except 包住，KV 缺失/损坏不 500 → 字段 None。前端 `NovelBar.typeLabel` 已读 `project.genre`，无需改（genre 优先于 type）。

### 5. `POST /chapters/{ref}/unarchive`（新端点）

`archive/router.py`（与 archive 同前缀，新路由）：
```python
@router.post("/{chapter_ref}/unarchive")
```
- 读章 YAML；`chapter["status"] = "draft"`；`pop("archive_path", None)`、`pop("archive_summary", None)`；写 YAML。
- `refresh_chapter_meta`（DB status=outline/draft 派生）+ 显式 `row.archived_at = None`、`row.status = "draft"`（try/except 降级）。
- 返回 `{"ok": True, "ref": chapter_ref}`。

前端 `ArchiveReader.tsx` 工具栏加「恢复」按钮（`onRestore` prop，父级传入 unarchive 调用 + 派发 `chapter:archived` 事件刷新树）。为最小改动，`onRestore` 由 `ArchivePage`/`Workbench` 提供。

## 退役/删除

- `archive/service.py` 内嵌列表更新块（vol YAML chapters status 同步）删除。

## 测试（TE-07 → `tests/test_write_archive_meta_sync.py`）

- SSE 初稿 refresh：`refresh_chapter_meta` 幂等——`save_prose` 后 DB word_count/has_prose/outline_status 正确（复用 test_dual_write 已验证 refresh 本体；此处补 archive/unarchive 链路）。
- archive DB 同步：HTTP 归档 → DB `status='archived'` + `archived_at` 非空 + 卷 YAML 内嵌列表不写 + `GET /volumes` 树 `archived=True`。
- unarchive 往返：HTTP unarchive → YAML status=draft + 清 archive_path + DB archived_at=None + 树 `archived=False`。
- genre 表面化：选题材 → `GET /novels/{id}` 响应 genre/genre_name；未选 → None 不 500。
- 既有 307 测试零回归。

## 风险与取舍

- **unarchive 为 P2 最小实现**：无前端「恢复」按钮前仅后端端点 + 阅读器按钮，不引入批量恢复/归档列表操作。
- **genre 读取仅详情端点**：`novel_to_dict` 保持同步（6 处调用）；列表不补 genre（无消费，避免 N+1）。
- **archive 停写内嵌列表是 change 006 收尾**：内嵌列表已无人读，删除避免双写残留。
