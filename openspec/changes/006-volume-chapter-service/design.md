# 006-volume-chapter-service — Design

## 架构总览

```
chapters/router.py（卷/章端点）         novels/router.py
  │  GET  /volumes → volumes.service.list_volumes       ── DB 全量树
  │  POST /volumes → volumes.service.create_volume      ── MAX+1 + 双写
  │  GET/PUT/DELETE /volumes/{ref} → volumes.service.{get,update,delete}_volume
  │  POST /volumes/{ref}/chapters → chapters.service.create_chapter   (替代旧 POST /chapters)
  │  GET  /chapters/{ref} → YAML 内容 + DB 元数据合并 + ensure_volume_row 懒补自愈
  │  PUT  /chapters/{ref} → chapters.service.save_chapter (engine.save_chapter + refresh_chapter_meta)
  │  PUT  /chapters/{ref}/prose → chapters.service.save_prose
  │  POST /chapters/{ref}/confirm → tier_or_gate + YAML confirmed + DB confirmed_at
  │  DELETE /chapters/{ref} → 删 YAML + DB 行 + versions + 计数维护
  └─ chapters/versions.py::restore_version → save_chapter + refresh_chapter_meta

volumes/service.py / chapters/service.py（业务服务，DB 双写第二步）
  ├─ refresh_chapter_meta：ensure_volume_row 懒补 → 重读 YAML → 只覆盖变更字段 → try/except 降级
  └─ 复用 repositories（change 005）+ count_chars + strip_suffix

novels/service.py::build_project_tree → DB 查询（GET /tree 结构不变，count_chars 口径）
frontend/useWorkbench.ts → loadVolumes 消费 DB 树 + createChapter 用 POST /volumes/{ref}/chapters
```

- **双写一致性（G1）**：一律「YAML 先写、DB 后更、以 YAML 为内容准、以 DB 为结构准」；DB 写失败**降级不 500**（try/except + warning），DB 行由读路径自愈（GET 懒补）与启动回填（change 005）兜底。
- **写路径停写内嵌列表**：create/delete/confirm 不再维护 `vol-N.yaml` 内嵌 chapters 列表（§4.3 唯一属主非镜像）→ 读路径（GET /volumes、build_project_tree）必须同 change 切 DB，否则树断裂（N11 同 commit 纪律）。
- **懒补收口**：所有 DB 行缺失场景统一走 `ensure_volume_row`（change 005，先 upsert 卷行再插章行）。
- **计数与插行同事务**：`chapter_count/total_chapters` 的 `+=1` 与插章行同 session 同 commit（防读改写竞态）。

## 关键实现点

### 1. `workflow/engine.py` 加 `strip_suffix`
```python
def strip_suffix(ref: str, suffix: str = ".yaml") -> str:
    return ref[: -len(suffix)] if ref.endswith(suffix) else ref
```
- 卷/章路由统一对 `{ref}` 调它，旧前端 `vol-1.yaml` / `vol-1-ch-1.yaml` 调用零断裂。

### 2. `volumes/service.py`
```python
async def list_volumes(db, project) -> dict:
    vols = await volume_repo.list_by_project(db, project.id)
    chapters = await chapter_repo.list_by_project(db, project.id)
    by_vol = defaultdict(list)
    for c in chapters:
        by_vol[c.volume_id].append(c)
    return [{
        "ref": f"vol-{v.volume_no}", "title": v.title, "summary": v.summary,
        "chapter_count": v.chapter_count,
        "chapters": [{
            "ref": c.ref, "volume": v.volume_no, "chapter": c.chapter_no,
            "title": c.title, "status": c.status, "word_count": c.word_count,
            "has_prose": c.has_prose, "outline_status": c.outline_status,
            "archived": c.status == "archived",
        } for c in by_vol.get(v.id, [])],
    } for v in vols]
```
- `create_volume`：`vol_no = await volume_repo.max_volume_no(db, project.id) + 1`；`tier_or_gate(db, project, gate_settings_complete)`；写 YAML `{volume,title,summary,chapters:[]}` → `volume_repo.upsert`（title/summary）→ `project.total_volumes += 1`（**不再 `= vol_num` 覆盖**）→ `update_phase(project,"outline")` → commit。DB 写失败 try/except + warning，不 500。
- `get_volume`：`strip_suffix(ref)` → `get_by_ref_or_number`；DB 行 + `read_yaml(volumes/vol-N.yaml)` 合并返回。
- `update_volume`：DB 行 title/summary 更新 + YAML 写（`data.pop("chapters", None)` 清派生快照；title/summary 双写，其余 key 只写 YAML）。
- `delete_volume`：取 DB 行 → `delete(session.delete(vol))`（CASCADE 删章）→ 删文件（vol YAML + chapters/vol-N-ch-* + versions/vol-N-ch-* + archives/vol-N-*）→ `project.total_volumes -= 1`、`total_chapters -= count` → commit。章数取 CASCADE 前 `chapter_repo.count_by_project`（删前数）。

### 3. `chapters/service.py`
- `create_chapter(db, project, volume_ref, title)`：`vol = await volume_repo.get_by_ref_or_number(db, project.id, strip_suffix(volume_ref))`；`chapter_no = await chapter_repo.max_chapter_no(db, project.id, vol.id) + 1`；`ref = f"vol-{vol.volume_no}-ch-{chapter_no}"`；写 `chapters/{ref}.yaml`（模板默认值，同现状 router 的 create_chapter 模板）→ `chapter_repo.upsert`（outline 初值）→ `vol.chapter_count += 1`、`project.total_chapters += 1` → commit。**不写内嵌列表**。
- `save_chapter(db, project, ref, data)`：`await engine.save_chapter(project.root_path, ref, data)` → `await refresh_chapter_meta(db, project, ref, data)`。
- `save_prose(db, project, ref, prose)`：`data = await get_storage().read_yaml(root, f"chapters/{ref}.yaml") or {}` → `data["prose"]=prose` → `engine.save_chapter` → `refresh_chapter_meta`。
- `refresh_chapter_meta`：
  ```python
  try:
      parts = ref.split("-"); vol_no = int(parts[1]); chapter = int(parts[3])
      vol = await volume_repo.ensure_volume_row(db, project.id, vol_no, title=None)
      row = await chapter_repo.get_by_ref(db, project.id, ref)
      yaml_data = await get_storage().read_yaml(project.root_path, f"chapters/{ref}.yaml") or {}
      prose = yaml_data.get("prose", "")
      derived_status = yaml_data.get("status") or (row.status if row else "outline")
      await chapter_repo.upsert(db, project.id, vol.id, chapter_no=chapter, ref=ref,
          title=yaml_data.get("title") or (data.get("title") if row is None else row.title) or f"第{chapter}章",
          status=derived_status, word_count=count_chars(prose), has_prose=bool(prose.strip()),
          outline_status=_derive_outline_status(derived_status, prose),
          confirmed_at=(row.confirmed_at if row else None),
          archived_at=(row.archived_at if row else None))
      await db.commit()
  except Exception:
      logger.warning("refresh_chapter_meta failed for %s", ref, exc_info=True)
  ```
  - `_derive_outline_status` 复用 change 005 的派生逻辑（confirmed→confirmed；summary/task 非空→in_progress；prose 非空→in_progress；否则 unfilled）——为与前端语义一致，prose 非空即 in_progress。

### 4. `chapters/router.py` 改造
- `list_volumes`：`return await volumes_service.list_volumes(db, project)`（**breaking change：新响应形状**）。
- `create_volume`：接 `volumes_service.create_volume`（忽略 body.vol_num）；返回 `{vol_num, filename, ref}`。
- `get_volume`/`update_volume`/`delete_volume`：路径参数名 `filename` → `ref`，接 service（`{ref}` 容 `.yaml`）。
- **新增 `POST /volumes/{ref}/chapters`** → `chapters_service.create_chapter(db, project, ref, title)`。
- **移除旧 `POST /chapters`**（`create_chapter` 端点整体删除）。
- `get_chapter`：`engine.load_chapter` YAML + DB 元数据合并；DB 行缺失 → 懒补自愈（复用 `refresh_chapter_meta` 的 ensure_volume_row + upsert 逻辑，或直接调一个 `_self_heal_chapter` helper）。
- `update_chapter`：接 `chapters_service.save_chapter`（含 refresh）；**删除**「重命名同步卷章列表 title」块（内嵌列表停写）。
- 新增 `PUT /chapters/{ref}/prose` → `save_prose`。
- `confirm_chapter`：`tier_or_gate` 已由 change 002 接好；追加 DB 写（status/outline_status/confirmed_at=now）；**删除**「update volume chapter list status」块。
- `delete_chapter`：删 YAML + `chapter_repo.delete` + 删 versions + 计数维护；**删除**「Remove from volume chapter list」块。

### 5. `novels/service.py::build_project_tree` 改 DB
- 复用 `volumes_service.list_volumes` 形状，包 `{project_id, volumes}`；DB 无行时降级现状文件扫描（防回填未跑的项目 404/空树）。

### 6. `chapters/versions.py::restore_version`
- `save_chapter` 后：`await chapters_service.refresh_chapter_meta(db, project, chapter_ref, chapter)`。

### 7. 前端 `useWorkbench.ts`（同 commit）
- `loadVolumes`：`const res = await api.get(\`/novels/${pid}/volumes\`); return res.map(v => ({ name: v.ref, title: v.title, chapters: v.chapters.map(c => ({...})) }))` —— 消费 DB 树，删逐卷 GET 降级。
- `createChapter`：`api.post(\`/novels/${pid}/volumes/${volRef}/chapters\`, { title })`。
- `createVolume`：删 `vol_num` 字段（后端忽略，零断裂可选）。
- `renameNode`：卷路径改用 `volumes/${nodeId}`（容 .yaml 已 OK，现状 `nodeId.yaml` 兼容）。

## 退役/删除
- `chapters/router.py::create_chapter`（旧 POST /chapters 端点）删除。
- 卷端点路径参数 `filename` 改 `ref`；响应形状随 service。
- `useWorkbench.ts` 的逐卷 GET 降级逻辑删除。

## 测试

- **TE-08/TE-09 → `tests/test_volume_chapter_crud.py`**：卷 CRUD 双写一致、MAX+1 忽略 vol_num、update 双写+pop chapters、删卷级联、{ref} 容 .yaml；建章章号自增、内嵌列表不写、计数同事务、GET 懒补自愈、confirm/delete。
- **TE-10 → `tests/test_dual_write.py`**：save/save_prose 后 DB 元数据正确、YAML 为内容准（prose 不入 DB）、DB 失败降级不 500、versions restore 刷新。
- **迁移**：`test_readiness.py`/`test_workflow_api.py` 的 `POST /chapters` → `POST /volumes/{ref}/chapters`。
- 既有 294 测试零回归（`python -m pytest tests/ -v`）。

## 风险与取舍

- **本 change 含 DB 树读迁移**：写路径停写内嵌列表强制 `GET /volumes` + `build_project_tree` 同 change 切 DB + 前端同 commit 迁移（N11）。change 007 剩余内容收敛为 `write/_stream_chapter` 补 refresh、`novel_to_dict` 补 genre、P2 unarchive 与 E2E 断言打磨。
- **`GET /tree` 降级**：DB 无行（未回填）回退文件扫描，防 404/空树。
- **confirm 不写内嵌列表**：现状 confirm 会写 `vol-N.yaml` 内嵌 status；停写后 DB 为准（`archived` 由归档写）。
- **refresh 以重读 YAML 为准**：避免 payload 缺省字段整行覆盖（P1-C）；`outline_status` 派生与前端 `has_prose` 语义对齐。
