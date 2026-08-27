# 卷/章双写服务 — Tasks

> BE-06 / BE-07 / BE-08 / BE-09 / BE-10 / BE-11 / BE-12 / BE-13 ｜ TE-08 / TE-09 / TE-10

## 能力 volume-service（BE-06 → BE-07）

- [ ] `workflow/engine.py`（改）：加 `strip_suffix(ref, ".yaml")`
- [ ] `volumes/__init__.py` + `volumes/service.py`（新）：list_volumes（DB 全量树）/ create_volume（MAX+1 + 忽略 vol_num + 双写 + total_volumes+=1）/ get_volume（容 .yaml）/ update_volume（title/summary 双写 + 其余只写 YAML + pop chapters）/ delete_volume（CASCADE 删章 + 删文件 + 计数维护）/ DB 失败降级不 500
- [ ] `chapters/router.py`（改）：GET/POST /volumes 接 service；GET/PUT/DELETE /volumes/{ref} 路径参数 filename→ref 接 service

## 能力 chapter-service（BE-08 → BE-13）

- [ ] `chapters/service.py`（新）：create_chapter（卷内建章 + 双写 + 不写内嵌列表 + 计数同事务）/ save_chapter（engine.save_chapter + refresh_chapter_meta）/ save_prose（prose 专用）/ refresh_chapter_meta（ensure_volume_row 懒补 + 重读 YAML 为准 + 只覆盖变更字段 + 降级不 500）
- [ ] `chapters/router.py`（改）：新增 `POST /volumes/{ref}/chapters`；**移除旧 `POST /chapters`**；GET /chapters/{ref} YAML+DB 合并 + 懒补自愈；PUT /chapters/{ref} 接 save_chapter（删「重命名同步内嵌 title」块）；新增 `PUT /chapters/{ref}/prose`；confirm 加 DB 写（删内嵌 status 块）；delete 加 DB 行/versions/计数（删内嵌列表块）
- [ ] `novels/service.py`（改）：build_project_tree 改 DB（GET /tree 结构不变 + count_chars 口径 + 无行降级文件扫描）
- [ ] `chapters/versions.py`（改）：restore_version 后 refresh_chapter_meta
- [ ] 前端 `useWorkbench.ts`（同 commit，N11）：loadVolumes 消费 DB 树（删逐卷 GET 降级）；createChapter 用 `POST /volumes/{ref}/chapters`；createVolume 删 vol_num

## 测试（TE-08 / TE-09 / TE-10）

- [ ] `tests/test_volume_chapter_crud.py`（新）：卷 CRUD 双写一致/MAX+1 忽略 vol_num/update 双写+pop chapters/删卷级联/{ref} 容 .yaml；建章章号自增/内嵌列表不写/计数同事务/GET 懒补自愈/confirm 写 DB/delete 清理
- [ ] `tests/test_dual_write.py`（新）：save/save_prose 后 DB 元数据正确/YAML 内容准（prose 不入 DB）/DB 失败降级不 500/restore 刷新
- [ ] `tests/test_readiness.py` + `tests/test_workflow_api.py`（改）：`POST /chapters` → `POST /volumes/{ref}/chapters` 迁移
- [ ] 既有 294 测试零回归

## 验收

- [ ] `cd client/backend && .venv/bin/python -m pytest tests/ -v` 全绿（新增 + 既有 294 零回归）
- [ ] 卷/章 CRUD 双写一致（YAML 内容准、DB 结构准）；`GET /volumes` 返回 DB 树（含 has_prose/outline_status/archived）
- [ ] 写路径不再维护 vol YAML 内嵌 chapters 列表；旧 `POST /chapters` 移除后 404/405
- [ ] `GET /tree` 结构不变（前端 useOutline 零改动）；DB 失败降级不 500；懒补自愈
- [ ] `cd client/frontend && npx tsc --noEmit` 通过（前端迁移同 commit）
