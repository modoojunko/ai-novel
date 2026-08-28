# 后端架构设计：创建小说 → 设定 → 卷纲 → 章纲 → 正文

> 后端架构师（engineering-backend-architect）视角 · 2026-08-10
> 原则：元数据入 SQLite（可查询/可统计），正文与卷章内容保持文件系统（YAML）——现有架构延续，只做必要扩展。

## 1. 对象关系总览

```
User 1 ── N Novel 1 ── N ProjectSetting
             │
             ├── N Volume（文件 volumes/vol-N.yaml）
             │      └── N Chapter（文件 chapters/vol-N-ch-M.yaml）
             │             ├── outline（摘要/要点/视角）
             │             ├── memo（当前任务/读者预期/必要变化）
             │             ├── emotional_design（情感基调）
             │             ├── segments（段落拆分）
             │             ├── prose（正文）
             │             └── N Version（文件 versions/vol-N-ch-M/v*.yaml）
             ├── N Prompt（文件 prompts/vol-N-ch-M-seg-K-prompt.md）
             └── N Archive（文件 archives/*.yaml）

Novel N ── 1 Genre（题材，外键）
Novel 1 ── 1 ApiConfig（AI 配置，可空）
```

## 2. 数据库表设计

### 2.1 现有表（保留，标注用途）

| 表 | 用途 | 关键字段 |
| --- | --- | --- |
| users | 用户 | id, username, password_hash, api_key(旧) |
| projects | 小说（Novel） | id, user_id, name, slug, root_path, current_phase, status, total_volumes/chapters/archives, source, backfill_status, ai_config_id, ai_model, created_at, updated_at |
| project_settings | 7 项设定（#126 存库重构） | project_id, setting_key, value(JSON), confirmed, updated_at |
| api_configs | AI Key 配置 | id, user_id, provider, base_url, api_key, model, status |
| genres | 题材库 | id, code, name, config(JSON) |
| events / audit_log / token_log | 事件与审计 | 现有结构 |

### 2.2 新增表（设计建议）

**volumes（卷元数据）** —— 支撑列表查询与进度统计

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | String(36) PK | UUID |
| project_id | String(36) FK→projects | 归属小说 |
| volume_no | Integer | 卷序号（vol-N） |
| name | String(200) | 卷名 |
| summary | Text | 卷摘要 |
| chapter_count | Integer | 章数（冗余，可统计） |
| created_at / updated_at | DateTime | 时间戳 |
| UNIQUE(project_id, volume_no) | | 唯一约束 |

**chapters（章元数据）** —— 支撑列表、状态、字数统计

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | String(36) PK | UUID |
| project_id | String(36) FK→projects | 归属小说 |
| volume_id | String(36) FK→volumes | 归属卷 |
| chapter_no | Integer | 章序号 |
| ref | String(64) | 文件引用（vol-1-ch-1），UNIQUE |
| title | String(200) | 章名 |
| status | String(20) | draft/in_progress/confirmed/archived |
| word_count | Integer | 正文字数（保存时刷新） |
| outline_status | String(20) | 章纲完成度（unfilled/in_progress/confirmed） |
| confirmed_at | DateTime null | 章纲确认时间 |
| created_at / updated_at | DateTime | 时间戳 |
| INDEX(project_id, volume_id, status) | | 列表查询索引 |

**chapter_outlines（章纲内容，可选）** —— 若章纲字段从 YAML 迁库（推荐保留 YAML，字段不进表；如需全文检索再迁）

> 决策：章纲的 memo/emotional_design/segments 是"一次写入、整读整写"的文档型数据，**保留 YAML**，DB 只存完成状态（chapters.outline_status）。避免 JSON 字段反规范化。

### 2.3 阶段进度（不建表）
- `projects.current_phase` 现有字段承载阶段流转；六阶段就绪度由现有 workflow/gates 计算，结果通过 `/settings/status`、phase-status 接口返回，不落库（实时计算，避免状态漂移）。

## 3. API 设计（REST，现有约定延续）

| 方法/路径 | 用途 | 说明 |
| --- | --- | --- |
| POST /api/novels | 创建小说 | body {name, genre_id?} → 201 {novel} |
| GET /api/novels | 作品列表 | 含 current_phase/total_volumes/chapters |
| GET /api/novels/{id} | 小说详情 | |
| GET /api/novels/{id}/settings/status | 7 项设定状态 | 已存在 |
| PUT /api/novels/{id}/settings/status/{key} | 确认某项设定 | 已存在（400 内容为空） |
| GET /api/novels/{id}/settings/{key} | 读设定内容 | 已存在 |
| PUT /api/novels/{id}/settings/{key} | 写设定内容 | 已存在 |
| GET /api/novels/{id}/volumes | 卷列表 | 新增 DB 查询版（替代纯文件扫描） |
| POST /api/novels/{id}/volumes | 创建卷 | body {name, summary} |
| PUT /api/novels/{id}/volumes/{ref} | 更新卷 | |
| POST /api/novels/{id}/volumes/{ref}/chapters | 卷内建章 | body {title} |
| GET /api/novels/{id}/chapters/{ref} | 章详情（outline/memo/prose） | 已存在 |
| PUT /api/novels/{id}/chapters/{ref}/outline | 保存章纲 | 整写 YAML + 刷新元数据 |
| POST /api/novels/{id}/chapters/{ref}/confirm | 确认章纲 | 已存在（gate 校验） |
| PUT /api/novels/{id}/chapters/{ref}/prose | 保存正文 | 整写 + word_count 刷新 |
| POST /api/novels/{id}/workflow/transition | 阶段推进 | 已存在（gate 校验） |
| GET /api/novels/{id}/chapters/{ref}/versions | 版本历史 | 已存在 |

## 4. 服务层设计

```
interfaces/  (FastAPI 路由，薄层)
   └── application/
        ├── NovelService        create/list/get、改名、删除
        ├── SettingsService     7 项设定读写 + 确认 + status 聚合
        ├── VolumeService       卷 CRUD、卷内章节
        ├── OutlineService      章纲整写、确认（调 gate_chapter_ready）
        ├── ChapterService      正文读写、字数统计、归档
        └── WorkflowService     阶段推进（gate 校验 + current_phase 更新）
infrastructure/
   ├── repositories/            SQLAlchemy 仓储（projects/settings/volumes/chapters）
   └── storage/                 文件存储（volumes/chapters/prompts/versions YAML）
domain/
   └── workflow/                gates/readiness（现有，纯函数）
```

要点：
- **双写一致性**：章节保存 = 写 YAML（正文/章纲）+ 更新 DB 元数据（word_count/outline_status/updated_at），在 ChapterService 内事务化（YAML 先写，DB 后更新；失败可重试/补偿）。
- **列表性能**：作品列表/卷列表/章列表走 DB 查询，不再扫描文件系统；正文读取仍走文件。
- **向后兼容**：新增 volumes/chapters 表通过迁移创建；首次启动对存量项目执行一次索引回填（扫描 YAML 生成元数据，幂等）。

## 5. 迁移与风险

| 项 | 说明 |
| --- | --- |
| 迁移 | Alembic 新增 volumes/chapters 表；回填脚本（幂等，标记 run-once） |
| 风险 1 | 存量项目无元数据 → 回填后才有列表/统计 |
| 风险 2 | 双写失败 → 以 YAML 为准，DB 元数据可重建 |
| 风险 3 | 并发保存 → 章节级文件锁或乐观版本号（versions 已天然快照） |
| 不做 | 章纲内容迁库、全文检索、多用户协作 |
