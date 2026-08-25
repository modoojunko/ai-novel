# 写/归档路径 DB 元数据同步 + genre 表面化 + P2 unarchive（007-write-archive-meta-sync）

## Why

change 006 把树读切到 DB（`GET /volumes`/`GET /tree` 均以 `volumes`/`chapters` 表为准），但**仍有三条写路径未同步 DB 元数据**，导致树显示漂移：

1. **SSE 初稿**（`write/router.py::_stream_chapter`）：写完 prose 只落 YAML，不调 `refresh_chapter_meta` → `word_count/has_prose/outline_status` 恒为建章初值，编辑器字数徽标/进度条不更新。
2. **续写**（`write/router.py::continue_writing` → `write/auxiliary.py::stream_continue`）：续写完成 `save_chapter` 后同样不刷新 DB。
3. **归档**（`archive/service.py::archive_chapter`）：仍写 vol YAML 内嵌 chapters 列表（change 006 已停写该列表，§4.3 唯一属主非镜像，已无人读），且**不更新 DB 章行 `status='archived'`/`archived_at`** → 归档后树仍显示非归档态，`useWorkbench` 的「chapter:archived → refresh」拿不到 📦。

另两条 P1/P2 表面化待办（change 006 范围外，归本 change）：

4. **`novel_to_dict` 补 genre**：`GET /novels/{id}` 序列化不含项目题材，前端 `NovelBar.typeLabel = project.type || project.genre || ""` 恒空。题材存 `project_settings` KV（key=`genre`，`{genre_id}`），读路径补上。
5. **`POST /chapters/{ref}/unarchive`（P2）**：归档把章 YAML 置 `status='archived'` + DB `archived_at`，无反向操作。`chapters.archived_at` 列（change 005 建）即为 unarchive 预留。归档阅读器已有「编辑」入口，unarchive 补「恢复」对称能力。

## What Changes

### BE-01 `write/router.py::_stream_chapter` 补 refresh

`write_chapter` 端点有 `db`+`project`；把二者透传给 `_stream_chapter`，`is_done` 写完 YAML 后调 `chapters.service.refresh_chapter_meta(db, project, chapter_ref, chapter)`（DB 失败降级不 500，写路径自愈约定不变）。

### BE-02 `write/auxiliary.py::stream_continue` 补 refresh

`continue_writing` 端点透传 `db`+`project` 给 `stream_continue`；`is_done` 保存 prose 后同样 `refresh_chapter_meta`。`polish_text`/`expand_text` 返回文本不落盘，前端经 `PUT /chapters/{ref}/prose` 保存（已 refresh），**不改**。

### BE-03 `archive` 写路径停写内嵌列表 + DB 章行同步

- `archive/service.py::archive_chapter` **删除**「同步卷章列表状态 → 前端树 📦」块（line 62-70，`volumes/vol-N.yaml` 内嵌 chapters 停写）。
- `archive/router.py::archive` 追加：`refresh_chapter_meta` 后显式置 DB 行 `status='archived'` + `archived_at=now`（同 session commit，try/except 降级不 500）。树读已切 DB，归档后立即呈 📦。

### BE-04 `GET /novels/{id}` 补 genre

`novel_to_dict` 保持同步签名（6 处调用，勿加 DB 异步）；在 `novels/router.py` 的单项目详情端点（`GET /novels/{id}`，ProjectShell 消费）读 `project_settings` KV（key=`genre`，root_path=project.root_path）并合并 `genre_id` + 题材名到响应。列表/改名等其余端点不补（无消费）。

### BE-05 `POST /chapters/{ref}/unarchive`（P2）

- 端点：置章 YAML `status='draft'`（清 `archive_path`/`archive_summary`，保留 prose）+ `refresh_chapter_meta` 后显式清 DB `archived_at`、`status='draft'`。
- 归档阅读器「恢复」按钮：`ArchiveReader` 工具栏加「恢复」→ 调 unarchive → `window.dispatchEvent(new CustomEvent("chapter:archived"))` 触发树刷新（复用现有事件通道）。

## Impact

- 后端修改：`write/router.py`、`write/auxiliary.py`、`archive/service.py`、`archive/router.py`、`novels/router.py`。
- 前端修改：`ArchiveReader.tsx`（恢复按钮）。
- 测试：`tests/test_write_archive_meta_sync.py`（SSE/续写 refresh 经 `refresh_chapter_meta` 单测 + archive DB 同步 + unarchive 往返 + genre 表面化）。既有 307 测试零回归。
- 行为变化：归档不再写 vol 内嵌列表（无人读，去重）；`GET /novels/{id}` 新增 `genre`/`genre_name` 字段（加性，前端零断裂）。

## Rollout

1. BE-01/BE-02：`_stream_chapter`/`stream_continue` 补 refresh + 端点透传
2. BE-03：`archive_chapter` 删内嵌列表块 + `archive` 端点 DB 章行同步
3. BE-05：unarchive 端点 + ArchiveReader「恢复」按钮
4. BE-04：`GET /novels/{id}` genre 合并 + NovelBar 显示
5. 测试 `test_write_archive_meta_sync.py` + 全量回归（pytest 307 + tsc/vitest 零回归）
