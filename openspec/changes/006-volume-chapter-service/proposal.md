# 卷/章双写服务（006-volume-chapter-service）

## Why

change 005 已建好 `volumes`/`chapters` 表 + 查询层 + 幂等回填（数据底座），但业务端点仍全走文件：`volumes/vol-N.yaml` 内嵌 chapters 列表是**唯一**树数据源。P1 断点 1 需要 `has_prose`/字数/归档态可查询（进度条、树徽标），而内嵌列表 word_count 恒 0、`GET /volumes` 逐文件扫描，无法高效聚合。

本 change 落地**双写核心**（G1 最大风险）：写路径「YAML 先写、DB 后更、以 YAML 为内容准、以 DB 为结构准」；**不再维护 vol YAML 内嵌 chapters 列表**（§4.3 唯一属主非镜像）。因此读路径必须同步切 DB——`GET /volumes` 与 `build_project_tree`（`GET /tree`）都读内嵌列表，二者与写路径更改**强制同 change 落地**（否则树断裂）。这正是「breaking change 同 commit 迁移」纪律（N11）要求的前端 `loadVolumes` + `test_readiness.py` 迁移。

## What Changes

### 能力 `volume-service`（BE-06 / BE-07）

- **`volumes/service.py`（新）**：
  - `list_volumes(db, project)`：DB 查询（`volume_repo.list_by_project` + `chapter_repo.list_by_project` 一次拉全、内存分组免 N+1），返回全量卷+章树元数据（`{ref,title,summary,chapter_count,chapters:[{ref,volume,chapter,title,status,word_count,has_prose,outline_status,archived}]}`）；**不做正文过滤**（N1 过滤在前端）。**接入 `GET /volumes`**（breaking change，同 commit 迁移前端 `useWorkbench.loadVolumes`）。
  - `create_volume(db, project, *, title, summary="")`：`volume_no = max_volume_no + 1`（**忽略/拒绝 body.vol_num**，B9/P2-N，防撞 UNIQUE）；gate 走 `tier_or_gate`（free 恒过）；**双写**：写 `volumes/vol-N.yaml` → DB 插行 → `project.total_volumes += 1`（现状 `= vol_num` 覆盖式是 bug）→ 同 commit；`update_phase("outline")` 幂等。**接入 `POST /volumes`**。
  - `get_volume(db, project, ref)`：`{ref}` 容 `.yaml` 尾缀（`strip_suffix`，旧前端 `vol-1.yaml` 调用零断裂）；DB 行元数据 + YAML 全字段合并返回。**接入 `GET /volumes/{ref}`**。
  - `update_volume(db, project, ref, body)`：`title/summary` **双写 DB 行 + YAML**；其余 key（PRO 卷纲全字段）**只写 YAML**；`data.pop("chapters", None)` 清派生快照（§4.3 去重）。**接入 `PUT /volumes/{ref}`**。
  - `delete_volume(db, project, ref)`：删 DB 行（**CASCADE 删章行**）→ 删 `volumes/vol-N.yaml` + `chapters/vol-N-ch-*.yaml` + `versions/vol-N-ch-*/` + `archives/vol-N-*.md`；`project.total_volumes -= 1`、`project.total_chapters -= 删除章数`（同 session 同 commit）。**接入 `DELETE /volumes/{ref}`**。
  - 工具 `strip_suffix(ref, ".yaml")` 放 `workflow/engine.py`（一处定义复用）。
- DB 写失败**降级不 500**：try/except + warning，YAML 已落，DB 行由读路径自愈（§4.4/§5-2）。

### 能力 `chapter-service`（BE-08 ~ BE-13）

- **`chapters/service.py`（新）**：
  - `create_chapter(db, project, volume_ref, title)`：经 `volume_repo.get_by_ref_or_number` 定位卷（容 `.yaml`）；`chapter_no = max_chapter_no + 1`；`ref = f"vol-{vol.volume_no}-ch-{chapter_no}"`；**双写**：写 `chapters/{ref}.yaml`（模板默认值）→ DB 插行（status='outline', word_count=0, has_prose=False, outline_status='unfilled'）→ `vol.chapter_count += 1`、`project.total_chapters += 1`（同 session 同 commit）；**不再写 vol YAML 内嵌 chapters 列表**。
  - `save_chapter(db, project, ref, data)`：`engine.save_chapter`（YAML 写 + 版本快照）→ `refresh_chapter_meta`（双写第二步）。
  - `save_prose(db, project, ref, prose)`：读 YAML → `data["prose"]=prose` → `engine.save_chapter` → `refresh_chapter_meta`（编辑器自动保存专用）。
  - **`refresh_chapter_meta(db, project, ref, data)`**：DB 行缺失 → `ensure_volume_row` 懒补前置；**以重读 YAML 为准、只覆盖本次变更字段**（title/status/word_count/has_prose/outline_status 从重读 prose 与 status 派生），不整行覆盖 payload 缺省字段；**DB 失败降级不 500**（try/except + warning，读路径自愈）。
- **端点**：
  - **新增 `POST /volumes/{ref}/chapters`**（body `{title}`）；**移除旧 `POST /chapters`**（breaking change，同 commit 迁移 `test_readiness.py`/`test_workflow_api.py`/前端 `useWorkbench.createChapter`）。旧端点删除后返回 404/405（不再双轨）。
  - `GET /chapters/{ref}`：YAML 内容 + DB 元数据（word_count/outline_status/status/confirmed_at/archived_at）合并返回；DB 行缺失 → `ensure_volume_row` 懒补（卷行前置）+ 插章行，不 500（读路径自愈收口）。
  - `PUT /chapters/{ref}`：沿用 `engine.save_chapter` + `refresh_chapter_meta`（重命名同步 title 到 DB；不再写内嵌列表）。
  - **新增 `PUT /chapters/{ref}/prose`**（body `{prose}`）：编辑器自动保存专用。
  - `POST /chapters/{ref}/confirm`：`gate_chapter_ready` 走 `tier_or_gate`（free 放行）；YAML confirmed + DB `status='confirmed'`/`outline_status='confirmed'`/`confirmed_at=now`（同 session commit）；不再写内嵌列表。
  - `DELETE /chapters/{ref}`：删 YAML + DB 行 + `versions/{ref}/`；`vol.chapter_count -= 1`、`project.total_chapters -= 1`（同 session commit）；不再改内嵌列表。
  - `chapters/versions.py::restore_version`：`save_chapter` 后追加 `refresh_chapter_meta`（BE-13，restore 后字数/状态刷新）。

### 读路径强制同步（内嵌列表停写 ⇒ 树读改 DB）

- **`GET /volumes`** → `list_volumes` DB 全量树（含 has_prose/outline_status/archived，不做正文过滤）。
- **`novels/service.py::build_project_tree`（`GET /tree`）改 DB 查询**：返回结构保持 `{project_id, volumes:[{ref,title,summary,chapter_count,chapters:[...]}]}`，前端 `useOutline.refetchTree` **零改动**；word_count 改 `count_chars` 口径（B5，修复 `/tree` 用 `len(prose)` 含空白漂移）。
- **前端同 commit 迁移**（N11，禁止跨 commit 断裂）：
  - `useWorkbench.loadVolumes`：直接消费 DB 树响应（`{volumes:[{ref,title,chapter_count,chapters:[{ref,title,status,word_count,has_prose}]}]}`），删除逐卷 GET 降级。
  - `useWorkbench.createChapter`：`POST /chapters` → `POST /volumes/{ref}/chapters`。
  - `useWorkbench.createVolume`：删 `vol_num` 字段（后端已忽略，零断裂可选）。

## Impact

- 后端新增：`volumes/service.py`、`volumes/__init__.py`、`chapters/service.py`。
- 后端修改：`chapters/router.py`（卷/章端点接 service + 新端点 + 移除旧 POST /chapters + GET 合并 + 懒补自愈 + confirm/delete）、`chapters/versions.py`（restore 刷新）、`workflow/engine.py`（strip_suffix）、`novels/service.py`（build_project_tree 改 DB）。
- 前端修改（同 commit）：`useWorkbench.ts`（loadVolumes 消费 DB 树 + createChapter 新端点）。
- 测试：新增 `tests/test_dual_write.py`（TE-10）、`tests/test_volume_chapter_crud.py`（TE-08/TE-09）；迁移 `test_readiness.py`/`test_workflow_api.py`（POST /chapters 替代）。既有 294 测试零回归。
- 行为变化：`GET /volumes` 返回 DB 树（breaking change）；`POST /chapters` 移除（breaking change）；写路径停写内嵌列表。`GET /tree` 结构不变。
- **范围外**：`write/_stream_chapter` 补 refresh（N10）、`novel_to_dict` 补 genre、`POST /chapters/{ref}/unarchive`（P2）→ change 007/008。

## Rollout

1. `workflow/engine.py` strip_suffix + `volumes/service.py`（list/create/get/update/delete）+ `chapters/router.py` 卷端点接 service
2. `chapters/service.py`（create_chapter + refresh_chapter_meta + save/save_prose）+ 章端点改造 + 新端点 + 移除旧 POST /chapters
3. `novels/service.py::build_project_tree` 改 DB + `versions.py` restore 刷新
4. 前端 `useWorkbench.ts` 迁移（loadVolumes + createChapter）
5. 测试迁移（test_readiness/test_workflow_api）+ 新增 test_dual_write/test_volume_chapter_crud → 全量 `pytest tests/ -v` 全绿（新增 + 既有 294 零回归）
