# 007-write-archive-meta-sync — Tasks

## BE-01 SSE 初稿 refresh
- [ ] `write/router.py::_stream_chapter` 加 `db, project` 参数，`is_done` 写 YAML 后 `refresh_chapter_meta`
- [ ] `write/router.py::write_chapter` 透传 `db, project`

## BE-02 续写 refresh
- [ ] `write/router.py::continue_writing` 透传 `db, project`
- [ ] `write/auxiliary.py::stream_continue` 加 `db, project` 参数，`is_done` 后 `refresh_chapter_meta`

## BE-03 归档 DB 同步
- [ ] `archive/service.py` 删除内嵌列表更新块（lines 62-70）
- [ ] `archive/router.py::archive` 追加 `refresh_chapter_meta` + 显式 DB `status='archived'`/`archived_at=now`（try/except 降级）

## BE-05 unarchive
- [ ] `archive/router.py` 新增 `POST /chapters/{ref}/unarchive`（YAML draft + 清 archive_path/summary + DB 清 archived_at）
- [ ] `ArchiveReader.tsx` 加「恢复」按钮 → unarchive + 派发 `chapter:archived` 刷新树

## BE-04 genre 表面化
- [ ] `novels/router.py` 详情端点读 `project_settings` KV（key=genre）合并 `genre`/`genre_name`（KV 缺失不 500）
- [ ] 确认 NovelBar typeLabel 已消费 `project.genre`

## 测试
- [ ] `tests/test_write_archive_meta_sync.py`：archive DB 同步 + unarchive 往返 + genre 表面化 + 归档过短仍 400
- [ ] 全量回归：`pytest tests/ -v`（307 零回归）+ 前端 tsc/vitest
