# 后端技术方案：C 端大改版（卷/章元数据入 SQLite + 免费/PRO 门控旁路）

> 后端技术负责人产出 · 2026-08-10
> 依据：共识裁决 `docs/prd/reviews/consensus.md`（C1–C6 + O1–O6）+ `docs/prd/backend-design.md` + 现状代码 `client/backend/`。
> 原则（与共识 §9「数据底座」一致）：**结构 = DB（volumes/chapters 表），内容 = YAML（正文/章纲/提示词/版本快照）**；YAML 内嵌 chapters 列表降级为派生数据；唯一属主非镜像，双写策略 = YAML 先写、DB 后更、以 YAML 为内容准、以 DB 为结构准。
>
> ⚠️ **本文为 v1 初稿。六角色评审（`reviews/{pm,ui,ux,frontend,backend,architect}.md`）后的终版修订见 `development-plan.md` v2 §4（后端要点）/§5（数据表）/§7（任务）与 `reviews/consensus.md` N1–N17 / B1–B10。以 v2 为准。**

---

## 0. 现状基线核对（从代码出发的事实，非假设）

- **表创建方式**：C 端无 Alembic（S 端 `server/alembic/` 才有）。`client/backend/main.py` lifespan 用 `Base.metadata.create_all` + 手工 `ALTER TABLE`（`source`/`backfill_status` 列即如此加列）。→ 迁移方案必须贴合此模式。
- **卷/章现状**：`chapters/router.py` 中 `GET /volumes` 靠 `list_dir` 文件扫描；`vol-N.yaml` 内嵌 `chapters` 列表；`create_chapter`/`confirm_chapter` 同时维护 YAML 内嵌列表 → **双写漂移源**（G1）。`build_project_tree`（`novels/service.py`）也从 vol YAML 的 chapters 列表重建树，且 `word_count` 恒为 0（YAML 内嵌项只存 `{chapter,title,word_count:0,status}`，从不刷新）。
- **免费主流程现状已被门控卡死**（G2）：
  - `create_volume` 调 `gate_settings_complete`（soft，不拦）；
  - `confirm_chapter` 调 `gate_chapter_ready`（**hard**，memo/emotional_design/segments 未填满 → 400）；
  - `workflow/transition` 的 `target=write` 依赖 `gate_prompts_exist`（**hard**）；
  - `POST /chapters/{ref}/archive` 与 `GET /archives*` **挂了 `require_ai_access`** → 免费用户（tier=none、无 Key、试用过期）归档会被 403/503 拦截 —— 与共识 §9 锁定「归档只读闭环」为免费能力**直接冲突，必须修**。
- **免费/PRO tier**：`auth_local/service.py::check_permission` 中 `tier == "none"` = 免费（免费有 `project_limit=1` 与 7 天 AI 试用，O1 待确认）；付费 = `monthly/quarterly/yearly`。tier 来自本地 `config.json`，前端经 `/api/auth/verify` 获取。
- **project_settings / 组合路由**：`CompositeStorageBackend` 把 settings 路径（`PATH_TO_KEY` 9 类 key）路由到 `project_settings` KV 表，`volumes/`、`chapters/`、`prompts/`、`archives/` 等路径仍走 `LocalFileBackend`。→ 卷/章元数据入 DB 不经过组合路由，由服务层直写，组合路由零改动。
- **七项设定**：`workflow/readiness.py` 的 `READINESS_CHECKERS` 恰为 7 项（synopsis/genre/world/style/anti-ai/hooks/characters）——与共识 C2「统一 7 项」吻合，后端零改动；`settings/status.py` 的 `VALID_TYPES = READINESS_KEYS ∪ {ai-model}`（9 类 key 口径不动）。

---

## 1. 数据表设计

### 1.1 新增表：`volumes`（卷元数据）

支撑卷列表、卷内章统计、抽屉摘要、树查询，全部走 DB 不再扫描文件。

| 字段 | 类型 | 约束/默认 | 说明 |
| --- | --- | --- | --- |
| id | String(36) | PK, default uuid4 | 逻辑主键 |
| project_id | String(36) | FK→projects.id, NOT NULL, **INDEX(project_id)** | 归属小说 |
| volume_no | Integer | NOT NULL | 卷序号（vol-N 的 N），创建时 `MAX(volume_no)+1` |
| title | String(200) | NOT NULL | 卷名（API/YAML 现用 `title`，与 backend-design 的 `name` 对齐到现状命名，见 §6 偏离说明） |
| summary | Text | NOT NULL default '' | 卷摘要（抽屉「卷名+卷摘要」免费字段；与 YAML summary 镜像双写） |
| chapter_count | Integer | NOT NULL default 0 | 冗余计数，创建/删除章时维护（可统计，列表免子查询） |
| created_at | DateTime | server_default now() | |
| updated_at | DateTime | server_default now(), onupdate | |
| **UNIQUE(project_id, volume_no)** | | | 同项目卷号唯一 |

> PRO 卷纲全字段（结构模板/核心冲突/情绪走向/信息差/冲突阶梯/场景卡/章节分配）**不入表**，继续存 `volumes/vol-N.yaml`（一次性整写整读文档型数据，与 backend-design §2.2「章纲保留 YAML」同理）。DB 只承载免费抽屉可编辑的 `title/summary` 元数据。

### 1.2 新增表：`chapters`（章元数据）

支撑章列表、字数、状态、章纲完成度、归档、正文树过滤。

| 字段 | 类型 | 约束/默认 | 说明 |
| --- | --- | --- | --- |
| id | String(36) | PK, default uuid4 | 逻辑主键 |
| project_id | String(36) | FK→projects.id, NOT NULL, **INDEX(project_id)** | 归属小说 |
| volume_id | String(36) | FK→volumes.id **ON DELETE CASCADE**, NOT NULL, **INDEX(volume_id)** | 归属卷；删卷级联删章 |
| chapter_no | Integer | NOT NULL | 章序号（ch-M 的 M），卷内 `MAX(chapter_no)+1` |
| ref | String(64) | NOT NULL, **UNIQUE(project_id, ref)** | `vol-N-ch-M`，稳定文件引用（`chapters/{ref}.yaml`） |
| title | String(200) | NOT NULL | 章名（与 YAML title 镜像双写） |
| status | String(20) | NOT NULL default 'outline' | 章状态：`draft / in_progress / outline(存量兼容) / confirmed / archived`。兼容现状 create→`outline`、import→`draft`、confirm→`confirmed`、archive→`archived` |
| word_count | Integer | NOT NULL default 0 | 正文字数，保存正文时刷新（现 YAML 内嵌项恒 0 的根因在此修复） |
| has_prose | Boolean | NOT NULL default False | `prose` 非空标记（正文树「只显示有正文章节」过滤 + 归档态标记用） |
| outline_status | String(20) | NOT NULL default 'unfilled' | 章纲完成度：`unfilled / in_progress / confirmed`（前端 deriveOutlineStatus 的落库版，DB 为准） |
| confirmed_at | DateTime | NULL | 章纲确认时间（confirm 时写） |
| archived_at | DateTime | NULL | 归档时间（archive 时写） |
| created_at | DateTime | server_default now() | |
| updated_at | DateTime | server_default now(), onupdate | |
| **INDEX(project_id, volume_id, status)** | | | 列表/树/归档态查询索引 |
| **INDEX(project_id, ref)** | | | ref 唯一索引（UNIQUE 已含，查询复用） |

> **不建 `chapter_outlines` 表**：章纲内容（outline/memo/emotional_design/segments）与正文 prose 继续整文件存 YAML（backend-design §2.2 已裁定「保留 YAML，DB 只存 outline_status」），避免 JSON 字段反规范化与双写。

### 1.3 不新增 / 不动的表

| 表 | 处理 |
| --- | --- |
| projects | **不改结构**。`total_volumes/total_chapters/total_archives` 降级为冗余计数：由 Volume/ChapterService 维护，回填时自愈为真实 COUNT；列表 `novel_to_dict` 继续读该列（免子查询） |
| project_settings | 不动，9 类 key 继续 KV（共识 C2「存储 9 类 key 不动」） |
| api_configs / genres / users / token_log / events / audit_log | 不动 |
| 六阶段就绪度 | 不落表，`workflow/gates.get_phase_status` 实时计算（backend-design §2.3，避免状态漂移） |

### 1.4 现有 models 扩展

- 新建 `models/volume.py`（`Volume`）、`models/chapter.py`（`Chapter`），在 `models/__init__.py` 注册 → `Base.metadata.create_all` 启动即建表（与现有 `_session_test_db` fixture 自动兼容）。
- `models/project.py::Novel` 加 relationship（可选）：`volumes = relationship("Volume", cascade="all, delete-orphan", back_populates="project")`，方便级联查询。
- 序列化：`novels/service.py::novel_to_dict` 保持原样（读 projects 冗余计数列），不改契约。

---

## 2. API 端点清单

> 标**新增**=该端点当前不存在；**合并**=在现有端点上升级（改 DB 查询 / 加 DB 写 / 加 tier 旁路）。URL 统一用 `ref`（`vol-1`、`vol-1-ch-1`）；`{ref}` 路由对**尾缀 `.yaml` 做容错**（`vol-1.yaml` 也接受，`strip_suffix(".yaml")`），旧前端调用零断裂。

### 2.1 免费主流程端点（本次交付核心）

| # | 方法/路径 | 用途 | 现状 | 变更 |
| --- | --- | --- | --- | --- |
| 1 | `POST /api/novels` | 建书（只填书名） | 已有 `novels/router.create` | **保持**。默认落点由前端 P0/G4 处理（后端 current_phase 仍置 settings，见 §5.2） |
| 2 | `GET /api/novels` | 作品列表 | 已有 | **保持**（total_volumes/chapters 读冗余列，回填自愈） |
| 3 | `GET /api/novels/{id}` / `PATCH /{id}` / `DELETE /{id}` | 详情/改名/删除 | 已有 | **保持**（改名不动 slug/root_path，现逻辑正确） |
| 4 | `GET /api/novels/{id}/volumes` | 卷列表 + 章树元数据 | 已有（文件扫描） | **合并**：改 DB 查询 `SELECT volume ORDER BY volume_no` + 每卷 `chapters` 子查询，返回 `{volumes:[{ref,title,summary,chapter_count,chapters:[{ref,volume,chapter,title,status,word_count,has_prose,outline_status}]}]}`。**正文树过滤规则 = `has_prose OR status='archived'`**（共识「只显示有正文章节」+ 归档章必显） |
| 5 | `POST /api/novels/{id}/volumes` | 创建卷 | 已有 | **合并**：写 `volumes/vol-N.yaml`（title/summary + 空 chapters）→ 插 DB 行；`gate_settings_complete` 改走 tier 旁路（§5.1）；`update_phase("outline")` 幂等保持 |
| 6 | `GET /api/novels/{id}/volumes/{ref}` | 卷详情 | 已有（{filename}） | **合并**：改 `{ref}`（容 .yaml）；DB 行元数据 + YAML 全字段（含 PRO outline）合并返回 |
| 7 | `PUT /api/novels/{id}/volumes/{ref}` | 更新卷（抽屉 + PRO outline 同一端点，共识 C3） | 已有（{filename}） | **合并**：body 拆两路——`title/summary` 写 DB 行 + YAML；其余 key（结构模板/核心冲突/…）只写 YAML。单端点双写，无数据模型分裂 |
| 8 | `DELETE /api/novels/{id}/volumes/{ref}` | 删除卷 | 已有（{filename}） | **合并**：删 DB 行（CASCADE 删章行）→ 删 `volumes/vol-N.yaml` + `chapters/vol-N-ch-*.yaml` + `versions/vol-N-ch-*/` + `archives/vol-N-*.md` |
| 9 | `POST /api/novels/{id}/volumes/{ref}/chapters` | 卷内建章 | 已有 `POST /chapters`（body {volume,chapter}） | **新增**（替代）：按 `{ref}` 定位卷；算 `chapter_no=MAX+1`；写 `chapters/{ref}.yaml`（模板默认值）→ 插 DB 行 → `volumes.chapter_count += 1` → `projects.total_chapters += 1`。**不再写 vol YAML 内嵌 chapters 列表**（§4.3） |
| 10 | `GET /api/novels/{id}/chapters/{ref}` | 章详情 | 已有 | **合并**：YAML 内容 + DB 元数据（word_count/outline_status/status/confirmed_at/archived_at）合并返回（DB 为准，YAML 缺失则回填） |
| 11 | `PUT /api/novels/{id}/chapters/{ref}` | 保存章（整写：章纲+正文） | 已有 | **合并**：沿用 `workflow.engine.save_chapter`（YAML 写 + 版本快照），**追加 DB 元数据刷新**（§3.2 `refresh_chapter_meta`）：word_count/has_prose/title/status/outline_status/updated_at |
| 12 | `PUT /api/novels/{id}/chapters/{ref}/prose` | 保存正文（编辑器自动保存专用） | **新增** | body `{prose}`：读 YAML → 写 prose → 版本快照 → 刷新 DB word_count/has_prose/updated_at。与 #11 共用 `ChapterService.save_prose`，两者互不干扰 |
| 13 | `POST /api/novels/{id}/chapters/{ref}/confirm` | 确认章纲 | 已有 | **合并**：`gate_chapter_ready` 走 tier 旁路（free 放行）；YAML `status='confirmed'` + DB `status/outline_status='confirmed'/confirmed_at`。不再写 vol YAML 内嵌列表 |
| 14 | `DELETE /api/novels/{id}/chapters/{ref}` | 删除章 | 已有 | **合并**：删 YAML + DB 行 + `versions/{ref}/`；`volumes.chapter_count -= 1` |
| 15 | `GET /api/novels/{id}/chapters/{ref}/versions`（含 `/content`、`/restore`、`/delete`） | 版本历史 | 已有 `chapters/versions.py` | **保持**；`restore` 后追加一次 DB word_count/has_prose 刷新（正文变了字数变） |
| 16 | `POST /api/novels/{id}/chapters/{ref}/archive` | 归档本章 | 已有（**require_ai_access 误挂**） | **合并（修正）**：**移除 require_ai_access**；写 `archives/vol-N-ch-M-*.md` + DB `status='archived'/archived_at` + YAML status；**AI 摘要降级可选**（§3.4） |
| 17 | `GET /api/novels/{id}/archives` / `GET /{filename}` | 归档列表/只读阅读 | 已有（**require_ai_access 误挂**） | **合并（修正）**：移除 require_ai_access，免费可读 |
| 18 | `GET /api/novels/{id}/settings/status` + `PUT /settings/status/{type}` + `GET/PUT /settings/{key}` + `/character/{name}` + `/characters/list` | 设定 7 项读写/确认 | 已有 | **保持**（9 类 key；免费只渲染人工字段属前端 tier 显隐，后端零改） |
| 19 | `GET /api/novels/{id}/workflow/phase-status` | 六阶段状态 | 已有 | **合并**：free 返回 `tier_bypass: true` + phases 全 `complete`（不展示不催促）；pro 走现状 |

### 2.2 PRO/AI 端点（本次只留门控占位，P3 再做解锁逻辑）

| # | 方法/路径 | 现状 | 本次动作 |
| --- | --- | --- | --- |
| 20 | `POST /api/novels/{id}/workflow/transition` | 已有（hard gate） | **合并**：gate 全部走 tier 旁路（free 放行但仍推进 current_phase，见 §5.2） |
| 21 | `/api/ai/*`（suggest-meta）、`/api/novels/{id}/settings/generate`、`/settings/ai/{type}/{field}`、`/prompts*`、`/write*`、`/story*`、`/ai-backfill*` | 全部已挂 `require_ai_access` | **保持**（这就是「免费直呼 AI 端点返回 403」的门控占位）。P3 再把它从「有无 API Key」改为「tier 是否 PRO」 |

> 备注：`settings/ai_router.py` 的 `POST /settings/ai/{type}/{field}`（generate_field）**漏挂** `require_ai_access`（源码未 import 未 Depends）——需补挂，防免费绕过（G3 端点级校验）。

---

## 3. 服务层设计

> 采用与现有代码一致的**扁平 service 函数 + FastAPI 薄路由**风格（不引入 backend-design 的四层 repository 骨架，避免对现有 30+ 路由模块做无关重构）。`application/`、`infrastructure/`、`domain/` 分层仅作为注释组织参考。

```
client/backend/
├── volumes/
│   ├── service.py          # VolumeService：create/list/get/update/delete
│   └── router.py           # 从 chapters/router.py 迁出卷端点（或原地改造）
├── chapters/
│   ├── service.py          # ChapterService：create/get/save/save_prose/confirm/delete
│   ├── router.py           # 章端点（改造）
│   └── versions.py         # 保持 + restore 后刷新 DB
├── repositories/
│   ├── volume_repo.py      # SQLAlchemy 查询（list_volumes/list_volume_chapters/…）
│   └── chapter_repo.py     # SQLAlchemy 查询（upsert 元数据/get_by_ref/delete…）
├── archive/service.py      # 改造：移除 AI 依赖 + DB 归档态写
├── workflow/
│   ├── tier.py             # 新增：tier 感知门控旁路层
│   ├── gates.py            # 纯函数保持；gate_chapter_ready 加可选参数（见 §5.1）
│   └── engine.py           # save_chapter 保持；新增 refresh_chapter_meta 工具
└── filesystem/
    └── index_volumes_chapters.py   # 新增：幂等回填
```

### 3.1 VolumeService（volumes/service.py）

```
async def create_volume(db, project, *, title, summary="") -> dict
  gate = await tier_or_gate(db, project, gate_settings_complete)   # free 恒过（§5.1）
  volume_no = max(volume_no for project) + 1
  write_yaml(f"volumes/vol-{volume_no}.yaml", {volume, title, summary, chapters_summary: [], chapters: []})
  row = Volume(project_id, volume_no, title, summary); db.add(row)
  project.total_volumes += 1; db.commit()
  update_phase(project, "outline")   # 幂等；free 也推进（O3 决策）
  return volume_to_dict(row)

async def list_volumes(db, project) -> list[dict]
  rows = volume_repo.list_by_project(project.id)            # ORDER BY volume_no
  chapters = chapter_repo.list_by_project(project.id)       # 一次性拉全，内存分组，免 N+1
  return [{ref, title, summary, chapter_count,
           chapters: [过滤 has_prose OR archived 的章元数据]}]

async def update_volume(db, project, ref, body) -> dict
  row = volume_repo.get_by_ref_or_number(project.id, ref)   # 容 .yaml 尾缀
  meta = {k: body[k] for k in ("title","summary") if k in body}
  if meta: 写 DB 行 + 写 YAML 对应键
  outline_fields = {k: body[k] for k in body if k not in ("title","summary","ref")}
  if outline_fields: read_yaml → 更新 → write_yaml    # PRO 全字段只进 YAML
  db.commit()

async def delete_volume(db, project, ref) -> dict
  row 定位 → 收集 chapters（refs）→ db.delete(row)（CASCADE）→
  删 volumes YAML + 每章 YAML + versions/{ref}/ + archives/vol-N-*.md
  project.total_volumes -= 1; project.total_chapters -= 删除数; db.commit()
```

### 3.2 ChapterService（chapters/service.py）——双写一致性核心

```
async def create_chapter(db, project, volume_ref, title) -> dict
  vol = volume_repo.get(...)
  chapter_no = chapter_repo.max_chapter_no(project.id, vol.id) + 1
  ref = f"vol-{vol.volume_no}-ch-{chapter_no}"
  write_yaml(f"chapters/{ref}.yaml", 模板默认（同现状 create_chapter）)
  db.add(Chapter(project_id, volume_id, chapter_no, ref, title, status="outline", word_count=0, has_prose=False, outline_status="unfilled"))
  vol.chapter_count += 1; project.total_chapters += 1; db.commit()

async def save_chapter(db, project, ref, data) -> dict
  await engine.save_chapter(root, ref, data)      # 现有：YAML 写 + 版本快照（内容不变时跳过）
  await refresh_chapter_meta(db, project, ref, data)   # 双写第二步

async def save_prose(db, project, ref, prose) -> dict
  data = load_chapter(root, ref) or {}
  data["prose"] = prose
  await engine.save_chapter(root, ref, data)      # 写 YAML + 版本快照
  await refresh_chapter_meta(db, project, ref, data)

async def refresh_chapter_meta(db, project, ref, data) -> None
  row = chapter_repo.get_by_ref(project.id, ref) or 懒补（YAML 在 DB 无行 → 插入）
  row.title = data.get("title", row.title)
  prose = data.get("prose", "")
  row.word_count = len(prose); row.has_prose = bool(prose.strip())
  row.status = data.get("status", row.status)
  row.outline_status = derive_outline_status(data, row)   # confirmed→confirmed；summary/task 非空→in_progress；否则 unfilled
  db.commit()

async def confirm_chapter(db, project, ref) -> dict
  gate = await tier_or_gate(db, project, gate_chapter_ready, chapter_data)  # free 放行（§5.1）
  chapter["status"]="confirmed"; write_yaml(...)
  row.status="confirmed"; row.outline_status="confirmed"; row.confirmed_at=now; db.commit()
```

**双写一致性事务方案**（SQLite 无跨「文件+DB」原子事务，采用**补偿式双写**）：

1. **写 YAML（内容准）**：`LocalFileBackend.write_yaml` 已原子（tmp + `os.replace`），正文/章纲失败不会写半截；
2. **写 DB（结构准）**：同请求 `session` 内更新元数据并 commit；失败不回滚 YAML——YAML 仍是内容唯一属主，DB 元数据可重建；
3. **补偿**：`refresh_chapter_meta` 发现 DB 无行时执行**懒补**（从 YAML 反解插入）；启动回填兜底；
4. **读路径自愈**：`GET /chapters/{ref}` 若 DB 行缺失 → 文件扫描懒重建 + 提示（或直接回填）。

### 3.3 OutlineService（确认/状态，收敛到 ChapterService）

确认章纲、`outline_status` 派生统一收在 `chapters/service.py`，不另建模块（避免空壳服务）。

### 3.4 ArchiveService（archive/service.py 改造）

```
async def archive_chapter(db, project, root_path, chapter_ref, full_text) -> dict
  # 免费闭环：写 md + 归档态，不依赖 AI
  write_md(f"archives/vol-N-ch-M-{slug}.md", full_text)
  row.status="archived"; row.archived_at=now; row.has_prose=True; db.commit()
  YAML status="archived"; write_yaml(...)
  # AI 摘要降级：免费/未配置 Key → 用正文首 200 字作 archive_summary，不调 AI
  try: summary = await _ai_summary(full_text)   # get_ai_client() 失败/免费 → fallback
  except: summary = full_text[:200]
  YAML archive_summary/archive_path 照写（P3 PRO 再恢复 AI 摘要）
```

> 关键修正：现状 `archive_chapter` 直接 `await get_ai_client()`，无 Key 即抛 503 → **归档在免费模式是硬故障**。改后免费归档全程无 AI 依赖。

### 3.5 列表性能

- 作品列表/卷列表/章列表走 DB，不再 `list_dir` + 逐文件 `read_yaml`（现状 `get_phase_status` 的 8 次文件读、`build_project_tree` 的逐章读都可省）；正文读取仍走文件。
- `list_volumes` 一次 `chapter_repo.list_by_project` 拉全章元数据，内存按 volume_id 分组，免 N+1。

---

## 4. 迁移与存量回填

### 4.1 建表（C 端无 Alembic 的落法）

1. 新建 `models/volume.py`、`models/chapter.py`，注册进 `models/__init__.py` → 启动 `Base.metadata.create_all` **自动建新表**（现有 lifespan 首行即可，测试 fixture `_session_test_db` 同步受益）。
2. **可选硬化（推荐 P1 一并引入）**：给 C 端补 Alembic（`alembic init` 到 `client/backend/`，`env.py` 复用 `Base.metadata`），新增 `001_volumes_chapters` 迁移；`main.py` lifespan 加 `upgrade head` 兜底。理由：后续字段演进有版本管理；不引入也可先靠 create_all + 幂等回填跑通（与现状 `ALTER TABLE` 模式一致）。

### 4.2 幂等回填脚本（filesystem/index_volumes_chapters.py）

原则：**行存在则跳过（INSERT-if-missing）**，同 `migrate_settings_to_db`（ADR-004）判据，杜绝重复索引；**只增不删**（文件被新写路径删除的孤儿 DB 行不清理，由写路径保证同步）。

```
async def index_volumes_chapters() -> None:
  for root in all_projects_root_paths():      # 含 import 项目
    vols = scan "volumes/vol-*.yaml"          # {volume_no, title, summary, chapters[]}
    for vol in vols:
      row = volume_repo.get(project_id, volume_no)
      if row is None: 插 Volume(project_id, volume_no, title, summary, chapter_count=0)
      for ch_meta in vol.chapters or []:
        ref = f"vol-{vol_no}-ch-{ch_meta['chapter']}"
        if chapter_repo.has(project_id, ref): continue
        ch_yaml = read_yaml(f"chapters/{ref}.yaml")
        if ch_yaml: 插 Chapter(ref, title=ch_yaml.title, status, word_count=len(prose),
                               has_prose=bool(prose), outline_status=derive(ch_yaml))
        else:       插 Chapter(ref, title=ch_meta.title, status=ch_meta.status, word_count=0)  # 卷内引用无文件
    # 孤儿章文件兜底：扫描 chapters/*.yaml 中 DB 无行且卷无行 → 反查 volume_no 建占位卷 + 章
    # 自愈计数
    project.total_volumes = COUNT(volumes); project.total_chapters = COUNT(chapters); commit
```

- **run-once 标记**：复用 `projects.backfill_status` 会与 AI backfill 语义冲突 → 新增列 `projects.index_status`（`none`/`done`，同 `source` 的加列模式），`index_status != "done"` 才跑；跑完置 done。判据与 INSERT-if-missing 双保险，重启幂等。
- **兼容现有文件结构**：回填只**读** `volumes/vol-N.yaml` 与 `chapters/vol-N-ch-M.yaml` 现有格式（volume/chapter/title/status/prose/outline/memo…），不改任何文件布局；旧文件原样保留，仅新增 DB 行。

### 4.3 YAML 内嵌 chapters 列表的去重（共识「唯一属主非镜像」）

- **回填完成后，写路径不再维护** `vol-N.yaml` 内嵌 `chapters` 列表（`create_chapter/delete_chapter/confirm_chapter` 不再改写它）；
- 读取以 DB 重建树；`chapter_writer` 读卷仅取 `title/summary`（不含 chapters 列表），不受影响；
- 存量文件里的旧列表作为**派生快照**保留不删；可选在 `update_volume` 时清空该键（`data.pop("chapters", None)`），彻底消除双写源（低风险，建议做）。

### 4.4 兼容既有调用方

| 调用方 | 兼容动作 |
| --- | --- |
| `novels/service.build_project_tree`（GET /tree） | 改写为 DB 查询（返回结构保持不变：volumes[].chapters[]），前端 `useOutline.refetchTree` 零改动 |
| `novels/router.import_persist` | 导入写 YAML 后**调用一次** `index_volumes_chapters()` 的 per-project 变体（`reindex_project(root)`），保证导入即列表可用，不必等下次重启 |
| `write/chapter_writer` | 读 `volumes/vol-N.yaml` 的 title/summary，兼容（不受 chapters 列表去重影响） |
| `workflow/gates.get_phase_status` | 章统计改读 DB（可选优化）；不优化也正确（纯函数仍可文件扫描，仅慢） |

---

## 5. 与 project_settings / 组合路由后端 / 六阶段 gate 门控的兼容与调整

### 5.1 tier 感知门控旁路层（G2 核心，新增 workflow/tier.py）

```
def tier_bypass(tier: str) -> bool:
    return tier == "none"          # 免费：全闸门通过；PRO：现状 gate 全部生效

async def tier_or_gate(db, project, gate_fn, *args) -> GateResult:
    tier = await get_tier(db, project)      # 从 config.json 读 tier（auth_local.service.check_permission）
    if tier_bypass(tier):
        return GateResult(valid=True, warnings=[], hard_block=False)
    result = await gate_fn(*args)
    return result
```

- 接入点：`create_volume`（gate_settings_complete）、`confirm_chapter`（gate_chapter_ready）、`workflow/transition`（三个 target 的 hard gate）。
- `gate_chapter_ready` 保持纯函数不动；free 分支不进校验逻辑。
- `phase-status` 响应在 free 追加 `tier_bypass: true`，前端据此隐藏 TabProgressButton/GateBanner/EmptyState（阶段 UI 不展示不催促，共识 §9）。

### 5.2 current_phase 在免费模式仍随操作推进（O3 决策）

- **决策**：free 下 `current_phase` 仍由 `update_phase` 幂等推进（建卷→outline、建章/确认→仍 outline、归档→archive 等），只是 UI 不展示、gate 不拦截。理由：① PRO 侧恢复 gate 时状态一致、无需重建；② `update_phase` 已幂等（同阶段直接 return），风险仅「非法跳转 ValueError」——free 下由 tier 旁路保证不会因 gate 失败而停在旧阶段。
- 新书默认落点 `settings` 不动（P0/G4 是前端 `NovelPage` 默认视图切 workbench 的问题，后端 current_phase 值保持 settings，两者不冲突）。

### 5.3 免费/PRO 端点门控占位（G3）

- AI 端点保持 `require_ai_access`（403 门控占位已满足）；P3 再语义改为「tier 非 PRO → 403」。
- **修复**：`settings/ai_router.py::generate_field` 补挂 `require_ai_access`。
- **修复**：`archive/*` 移除 `require_ai_access`（免费核心能力，见 §3.4）。

### 5.4 project_settings / 组合路由

- **零改动**：`PATH_TO_KEY`、`CompositeStorageBackend`、`DatabaseFileBackend`、`seed_settings_to_db` 全保持；volumes/chapters 路径仍走 LocalFileBackend；新 DB 表由服务层直写，不引入组合路由。
- 设定 7 项展示口径（C2）是**前端收敛**，后端 `VALID_TYPES`（9 类）与 `READINESS_KEYS`（7 项）保持现状；`ai-model` 独立配置不进 n/7，后端不变。

### 5.5 免费限 1 本（O1 待确认）

后端 `require_project_limit` 现状即「免费 tier=none → project_limit=1」；共识 O1 未决，本次**保持现状不动**，待 owner 确认口径后再调。

---

## 6. 与 backend-design.md 的偏离与裁决（显式）

| # | backend-design 建议 | 本方案裁决 | 理由 |
| --- | --- | --- | --- |
| D1 | volumes.name | **volumes.title** | 现状 API/YAML/前端 `VolumeEntry` 全用 `title`（`create_volume` body `title`）；沿用 `title` 免前端改字段名。DB 列名与 API 一致，降低 ORM↔DTO 心智负担 |
| D2 | 四层 application/infrastructure/domain 骨架 | **扁平 service + repositories 查询模块** | C 端现状是扁平路由 + service 函数（30+ 模块），四层重构属无关大改，违背「精准修改」；repositories 仅作 DB 查询集中点，不建完整分层 |
| D3 | 回填「标记 run-once」 | 新增 `projects.index_status` 列 + INSERT-if-missing 双保险 | 复用 `backfill_status` 会与 AI step1/step2 回填状态冲突 |
| D4 | — | **移除 archive 的 require_ai_access + AI 摘要降级** | backend-design 未覆盖；现状归档被 AI 门控卡死，与共识 §9「归档只读闭环」免费冲突，必须修 |
| D5 | — | **补挂 settings/ai_router.generate_field 的 require_ai_access** | 现状漏挂，免费可绕过（G3） |

---

## 7. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 双写漂移（G1，最大风险） | YAML 内容准 + DB 结构准；写路径停维护 YAML 内嵌 chapters（§4.3）；读路径懒补 + 启动回填兜底 |
| 免费用户归档被 AI 依赖卡死 | §3.4 移除归档的 AI 强依赖（摘要降级） |
| 回填非幂等/重复索引 | INSERT-if-missing + `index_status` run-once + 只增不删 |
| 并发保存 | 单用户桌面，章节粒度；`save_chapter` 已有版本快照；DB 元数据 update 在同一 session 串行 commit |
| 免费 gate 误伤 PRO 语义 | tier 旁路只在 `tier==='none'` 生效；PRO 全走现状 gate |
| 孤儿 DB 行/孤儿文件 | 写路径保证同步；回填只增不删，`reindex_project` 可重建；可选清理脚本 |

## 8. 测试计划

新增测试（对齐现有 pytest 风格，mock `get_storage`/临时 DATA_ROOT）：

| 测试 | 覆盖 |
| --- | --- |
| `test_volume_chapter_index.py` | 回填幂等（跑两遍行数不变）、孤儿章文件建占位卷、import 项目回填、`index_status` run-once |
| `test_dual_write.py` | `save_chapter`/`save_prose` 后 DB word_count/has_prose/outline_status 正确；YAML 仍是内容准 |
| `test_volume_chapter_crud.py` | 卷/章 CRUD 的 DB+YAML 一致性、卷内章号自增、级联删卷删章 |
| `test_free_bypass.py` | tier=none：confirm 无 memo 也过、transition 全放行、phase-status 带 tier_bypass |
| `test_archive_free.py` | 无 API Key 可归档（摘要降级）、归档态写入 DB、`GET /archives` 免费可读 |
| `test_tree_db.py` | `GET /volumes` 返回 DB 树、正文树过滤（has_prose OR archived） |

---

## 附：改动文件清单

| 文件 | 动作 |
| --- | --- |
| `models/volume.py`、`models/chapter.py` | 新增（表 1.1/1.2） |
| `models/__init__.py` | 注册 Volume/Chapter |
| `models/project.py` | 加 `index_status` 列 + 可选 relationship |
| `volumes/service.py`、`volumes/router.py`（或改造 `chapters/router.py`） | 卷端点 + VolumeService |
| `chapters/service.py`、`chapters/router.py`、`chapters/versions.py` | ChapterService 双写 + 端点扩展 + restore 刷新 |
| `repositories/volume_repo.py`、`repositories/chapter_repo.py` | 新增 DB 查询集中点 |
| `archive/service.py`、`archive/router.py` | 移除 AI 强依赖 + DB 归档态 |
| `workflow/tier.py` | 新增门控旁路层 |
| `workflow/gates.py`、`workflow/engine.py`、`workflow/router.py` | 接入 tier_or_gate + refresh_chapter_meta |
| `filesystem/index_volumes_chapters.py` | 新增幂等回填 |
| `main.py` | lifespan 挂回填 + `index_status` 加列 |
| `novels/service.py`（build_project_tree）、`novels/router.py`（import_persist） | 树改 DB、导入后 reindex |
| `settings/ai_router.py` | 补挂 require_ai_access |
| `tests/*` | 按 §8 新增 |
