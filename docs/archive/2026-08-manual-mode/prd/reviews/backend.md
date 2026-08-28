# 后端可行性评审：C 端大改版（volumes/chapters 入 DB + tier 旁路 + 归档免费化）

> 角色：后端架构师（engineering-backend-architect）独立评审 · 2026-08-10
> 范围：`docs/prd/tech-backend.md` 对「非 AI 基础能力 + 页面 UI&UX 数据底座」的后端可落地性
> 依据：tech-backend.md / backend-design.md / consensus.md / architect.md / PRD.md / ui-design.md + 现状代码 `client/backend/`（全部实际阅读）
> 视角：后端能不能落地、数据模型是否自洽；不评产品取舍

---

## 1. 总体结论

**方案总体可行、方向正确（元数据入 SQLite、YAML 内容唯一属主、tier 旁路、归档去 AI 依赖），但存在 1 个必须先行修复的 P0：tier 旁路只绕过 gate、不绕过 `update_phase` 的阶段跃迁校验，免费模式「建卷即 outline → 直接归档」的路径会触发 `outline→archive` 非法跃迁 ValueError → 500。** 其余为 P1/P2 级缺口，不影响主方向，但需在落地前排清。

---

## 2. 现状基线核对结果

### 2.1 技术方案判断「准确」的部分（均已对照源码确认）

| 技术方案断言 | 源码位置 | 核对 |
| --- | --- | --- |
| C 端无 Alembic，lifespan 用 `create_all` + 手工 `ALTER TABLE`（source/backfill_status 列） | `main.py:42-76` | 准确 |
| `GET /volumes` 靠 `list_dir` 文件扫描，返回 `[{filename, name}]`；vol-N.yaml 内嵌 chapters 列表；create/confirm 维护内嵌列表（双写漂移源 G1） | `chapters/router.py:14-28, 118-285` | 准确 |
| `build_project_tree` 从 vol YAML 内嵌 chapters 列表重建树，`word_count` 恒 0 | `novels/service.py:147-182` | **基本准确，1 处例外见 2.2** |
| `create_volume` 调 `gate_settings_complete`（soft，不拦） | `chapters/router.py:42-45`；`gates.py:26-53`（hard_block 恒 False） | 准确 |
| `confirm_chapter` 调 `gate_chapter_ready`（hard，memo/emotional_design/segments 未填满→400） | `chapters/router.py:263`；`gates.py:56-85` | 准确 |
| `workflow/transition` 的 `target=write` 依赖 `gate_prompts_exist`（hard） | `workflow/router.py:87-110` | 准确（另 `target=prompt` 也是 hard） |
| archive 三端点（POST archive / GET archives 列表 / GET archives/{filename}）挂 `require_ai_access` | `archive/router.py:29,55,73` | 准确 |
| `check_permission` tier=="none"=免费，project_limit=1，7 天试用 | `auth_local/service.py:286-325`；`auth_local/deps.py:66-87` | 准确 |
| `CompositeStorageBackend` 设定路径路由 DB、其余走 LocalFileBackend → 卷/章元数据入 DB 不经组合路由 | `filesystem/composite_storage.py:19-46`；`filesystem/paths.py:28-34` | 准确 |
| `READINESS_CHECKERS` 恰为 7 项（synopsis/genre/world/style/anti-ai/hooks/characters） | `workflow/readiness.py:79-87` | 准确 |
| `settings/ai_router.generate_field` 漏挂 `require_ai_access`（generate_all_settings 有挂） | `settings/ai_router.py:23-30` vs `79-126` | 准确（D5 成立） |
| `archive_chapter` 直接 `await get_ai_client()`，无 Key 即硬故障 | `archive/service.py:37-49`；`ai_client.py:46-49`（无 Key 抛 ValueError） | 准确，**错误码见 2.2** |
| 测试 fixture `_session_test_db` 用 `create_all`，新模型注册即自动建表 | `tests/conftest.py:62-77` | 准确 |
| `write/chapter_writer` 只读卷 YAML 的 title/summary，不受 chapters 列表去重影响 | `write/chapter_writer.py:184-188` | 准确 |
| `/write*`、`/prompts*`、`/story*` 全部已挂 `require_ai_access` | `write/router.py`、`prompt/router.py`、`story/router.py` | 准确 |
| 前端树走 `GET /tree`（build_project_tree），`useOutline.refetchTree` 消费 | `client/frontend/src/hooks/useOutline.ts:160` | 准确 |

### 2.2 与技术方案不符 / 需修正的基线判断

| # | 偏差 | 说明 |
| --- | --- | --- |
| B1 | **`build_project_tree` 的 `word_count` 恒 0 并非全量成立**：手工 `create_chapter` 写入的内嵌项是 `{chapter,title,word_count:0,status}`（无 prose），恒 0；但 **import 项目** `import_persist` 把 `{volume,chapter,title,status,prose}` 整块塞进内嵌列表，`novels/service.py:166` 的 `len(ch.get("prose",""))` 会算出真实字数。技术方案「恒为 0」只对创建型项目成立，import 项目例外。影响：回填/去重时内嵌列表的 `word_count` 不可信，必须以 `chapters/{ref}.yaml` 文件为准。 | 低 |
| B2 | **无 Key 归档的失败码是 500 不是 503**：`ai_client.py` 无 Key 时 `AIClient.__init__` 抛 `ValueError`，`archive/router.py` 未捕获 → FastAPI 返回 500；503 只出现在显式 `try/except ValueError → HTTPException(503)` 的端点（如 `novels/router.py:102-104` suggest_meta）。技术方案「抛 503」描述不准，但不影响「免费归档硬故障」这一核心结论。 | 低 |
| B3 | **「VALID_TYPES（9 类）」表述混淆**：`settings/status.py:14` 实际 `VALID_TYPES = READINESS_KEYS ∪ {ai-model}` = **8 类**（7+ai-model）。「9 类 key」指存储路由（`paths.py` PATH_TO_KEY 8 类 + characters 目录），不是 VALID_TYPES。技术方案 §0 末行与 §5.4 把两者混写为「VALID_TYPES（9 类）」，属事实性小错，落地时按 8 类确认端点即可。 | 低 |
| B4 | **`gate_archived` 查 `.yaml` 但归档文件全是 `.md`**（`gates.py:167` vs `archive/service.py:33`）：archive 阶段 gate 永远 valid（soft 提醒），即使已归档 phase-status 的 archive 阶段也永远显示 in_progress。技术方案未覆盖。改 DB 后建议 `chapters.status=='archived'` 计数取代文件扫描。 | 中 |

---

## 3. 数据表设计评审

### 3.1 volumes 表

| 项 | 评审 | 建议 |
| --- | --- | --- |
| `id String(36) PK uuid4` | 与现有 Novel.id 模式一致，好 | 采纳 |
| `project_id FK→projects.id NOT NULL + INDEX` | 正确；注意与现有 `project_settings` 用 `root_path` 作键的模式不同，新表用 project_id 是更优选择（root_path 仅由 slug 派生、重命名不动，但 project_id 语义更准） | 采纳；删除项目是软删（`novels/service.py:105-107` 置 status=deleted），不会触发级联，孤儿行由所有权查询天然隔离，可接受 |
| `UNIQUE(project_id, volume_no)` | 必须。**现状 `create_volume` 接受 body.vol_num**（`chapters/router.py:48`），客户端可传任意卷号；入表后重复卷号会撞唯一约束 500。技术方案改 `MAX(volume_no)+1` 正确，但需显式忽略/拒绝 body.vol_num | 采纳 MAX+1，兼容期忽略 body.vol_num |
| `title String(200) NOT NULL` | D1 采纳 `title` 正确（现状 API/YAML/前端 VolumeEditor/NovelPage 全用 title） | 采纳 |
| `summary Text default ''` | 抽屉免费字段，镜像双写 | 采纳 |
| `chapter_count Integer default 0` | 冗余计数，写路径维护；漏一次即漂移 | 采纳，但见 P2-L（可考虑实时 COUNT） |
| 卷纲全字段不入表 | 与 backend-design §2.2 一致（文档型整读整写），好 | 采纳 |

### 3.2 chapters 表

| 项 | 评审 | 建议 |
| --- | --- | --- |
| `volume_id FK→volumes.id ON DELETE CASCADE NOT NULL + INDEX` | SQLite 级联依赖 `PRAGMA foreign_keys=ON`（`db.py:16-19` 已设）+ ORM FK 显式 `ondelete="CASCADE"`。ORM 层建议同时在 `Volume` 加 `chapters = relationship("Chapter", cascade="all, delete-orphan")` 双保险 | 采纳；实现时两者都加 |
| `UNIQUE(project_id, ref)` | 正确；`ref` 已是稳定文件引用 | 采纳 |
| `status String(20) default 'outline'` | 枚举 draft/in_progress/outline(存量)/confirmed/archived，与现状 create→outline、import→draft、confirm→confirmed、archive→archived 吻合 | 采纳 |
| `word_count` / `has_prose` | 修复「内嵌项恒 0」根因的正确落点 | 采纳，**口径需统一**（P2-F） |
| `outline_status` / `confirmed_at` | DB 为准，前端 deriveOutlineStatus 落库 | 采纳，**确认后编辑的降级语义需定义**（P2） |
| `INDEX(project_id, volume_id, status)` | 列表/树/归档态查询足够 | 采纳 |
| `INDEX(project_id, ref)` 单独列出 | `UNIQUE(project_id, ref)` 已含该索引，重复声明无害但多余 | 可去掉 |
| 不建 `chapter_outlines` 表 | 章纲保留 YAML，DB 只存 outline_status —— 正确，避免 JSON 反规范化 | 采纳 |

### 3.3 迁移与回填风险

| 项 | 评审 | 风险 |
| --- | --- | --- |
| `create_all` 建新表 | `models/__init__.py` 注册即建，与 conftest 自动兼容，稳妥 | 低 |
| `projects.index_status` 加列 | 与 source/backfill_status 同模式（`main.py:60-76`）；**必须放在回填脚本调用之前**。D3 判据（不复用 backfill_status）正确 | 低 |
| 幂等回填 INSERT-if-missing + run-once + 只增不删 | 与 `migrate_settings_to_db`（ADR-004）判据一致，稳妥；回填中途失败 index_status 保持 none，重启重跑安全 | 低 |
| 回填只读现有 YAML 布局 | 兼容 import 项目（source=import 也有 vol/ch YAML） | 低 |
| 孤儿章建占位卷 | 反查 volume_no 建卷正确；**占位卷 title 需定**（建议「导入卷 N」或取内嵌项 title） | 低 |
| **读路径自愈缺「卷行前置」** | `chapters.volume_id NOT NULL`，懒补若只插章行而卷行缺失会 FK 失败。技术方案 §3.2 只写「懒补（YAML 在 DB 无行→插入）」，未提先 upsert 卷行；§4.2 回填有建占位卷，但读路径没有 | **中（P1-D）** |

---

## 4. 后端方案问题清单

### P0（必须先行修复，否则免费主流程不可用）

| # | 问题 | 证据 | 修正建议 |
| --- | --- | --- | --- |
| P0-1 | **free 模式归档 500：`update_phase` 非法跃迁**。免费流程 create_volume 把 `current_phase` 推到 `outline`（`chapters/router.py:47`）；随后用户直接写正文、归档，`archive/router.py:42` 调 `update_phase(project, "archive")`，而 `ALLOWED_TRANSITIONS["outline"]=["prompt"]`（`engine.py:12-19`）→ `ValueError` → 500。**tier 旁路只绕过 gate，不绕过 update_phase 的阶段跃迁校验**。技术方案 §5.2 明确写「归档→archive 等」在 free 下推进，与 `engine.py` 直接冲突。移除归档 require_ai_access 后免费用户才真正触达此路径，是本次改版第一刀必踩的坑 | `engine.py:26-34`；`archive/router.py:42`；`chapters/router.py:47` | 三个选项择一：(a) free 下 archive 路由不调 `update_phase`（current_phase 只是 PRO 进度信号，免费不展示）；(b) `update_phase` 加 `force=True`，tier_bypass 时跳过 can_transition 校验；(c) 放宽 transition 表允许 `outline→archive`（会污染 PRO 语义，不推荐）。建议 (a) 或 (b)。同族问题：free 下 `workflow/transition target=write`（`workflow/router.py:108`）从 outline 直接跃 write 也非法，但免费 UI 不调该端点，风险低，仍需在 tier 旁路设计里统一处理 |
| P0-2 | **`/write` 流式写正文不经过 save_chapter，AI 写完后 DB 元数据不刷新**：`write/router.py` 的 `_stream_chapter` 直接 `get_storage().write_yaml(...)` 写 prose（`write/router.py:112-114`），未走 ChapterService.refresh_chapter_meta。虽然 AI 端点本次被 require_ai_access 挡（P3 范围外），但 P1 落库后 PRO 用户 AI 写作的字数/状态将永久陈旧，属回归 | `write/router.py:110-115` | P1 落地时同步给 `_stream_chapter` 完成写入后补一次 `refresh_chapter_meta`；或 P1 暂不改（AI 端点在 P3 前仍被门控），但需在 P3 计划中显式列出 |

### P1（应在本交付内处理）

| # | 问题 | 修正建议 |
| --- | --- | --- |
| P1-A | **GET /volumes 响应形状是破坏性变更，非「合并」**：现状返回 `[{filename, name}]`，前端 `NovelPage.loadVolumes` 逐卷再 GET `/volumes/{filename}` 拼 chapters（`NovelPage.tsx:261-276`）。技术方案 #4 改为树形响应，现有前端直接断裂。技术方案把它表述为向后兼容的「合并」不准确 | 标注为 breaking change；若 P2 前端同步重写可接受，否则保留旧响应或加 `?tree=1` 双轨 |
| P1-B | **POST /chapters 替换破坏现有调用方/测试**：`test_readiness.py:263` 用 `POST /chapters {volume, chapter}` 建章；前端 NovelPage 同样依赖。技术方案 #9「新增（替代）」未列测试迁移 | 保留旧端点作 deprecated alias，或显式列入测试改动清单（技术方案 §8 测试计划未含 test_readiness.py 的迁移） |
| P1-C | **新增 `PUT /chapters/{ref}/prose` 与现有 `PUT /chapters/{ref}` 共用 save_chapter，但 `refresh_chapter_meta` 用请求 payload 而非重读 YAML**：若 payload 与已写 YAML 不一致（如只传 prose 不传其余字段的编辑器自动保存），title/outline_status 会回退为 payload 缺省值 | refresh 前以 `load_chapter` 结果为准（YAML 是内容准），或 refresh 只覆盖「本次变更字段」不整行覆盖 |
| P1-D | **读路径自愈缺卷行前置**（见 3.3）：GET /chapters/{ref} 懒补时需先 upsert `Volume` 行（ref 反解 volume_no），否则 FK `volume_id NOT NULL` 失败 | 懒补/自愈统一收口到 `ensure_volume_row(project_id, volume_no)`，回填与读路径共用 |
| P1-E | **正文树过滤（`has_prose OR archived`）与大纲高级视图全树冲突**：C3 双轨要求正文工作台树过滤、高级配置大纲视图显示全树（含空章）。单端点直接过滤会丢空章，大纲视图崩 | GET /volumes 返回全量章元数据 + `has_prose` 标记，过滤交给前端（数据都在，前端一行 filter）；或加 `?filter=has_prose` 查询参数 |
| P1-F | **`confirm_chapter` 确认后仍写 vol YAML 内嵌列表状态**（现状 `chapters/router.py:270-284`），技术方案 #13 改为不写，但**删除该段逻辑属删除既有行为**，需确认 PRO 模式下旧文件的内嵌列表状态不再被任何读取方依赖（build_project_tree 改 DB 后即不依赖） | 改 DB 树后即可移除；§4.3 的「update_volume 时 pop chapters 键」建议执行 |

### P2（可放后续或低成本处理）

| # | 问题 | 修正建议 |
| --- | --- | --- |
| P2-G | **`gate_archived` 查 `.yaml` 但归档是 `.md`**：archive 阶段状态永远 in_progress（PRO 模式阶段显示 bug） | 改 DB 后从 `chapters.status=='archived'` COUNT |
| P2-H | **版本 restore 后 DB 刷新不全**：快照含 status/outline（`versions.py:111-114`），restore 会改 status；技术方案 #15 只提 word_count/has_prose | restore 后连 status/outline_status/confirmed_at 一起刷 |
| P2-I | **`tier_bypass` 语义**：仅 `tier=="none"` 旁路；**过期付费用户**（tier=monthly, `check_permission` 返回 allowed=False）不旁路 → 被 hard gate 卡住免费人工写作。与「免费=完整人工写作」定位相悖 | 旁路条件改为「当前无付费权益」（allowed==False 或 tier=="none"），而非裸 tier 字符串 |
| P2-J | **word_count 口径未统一**：`len(prose)` 含换行/空白/Markdown 符号；前端实时字数口径可能不同 → 列表字数与编辑器实时字数对不上 | 定一个字数函数（如去空白后的中文字符数）前后端共用 |
| P2-K | **内嵌 chapters 列表写路径未清点全**：技术方案 §4.3 只列 create/delete/confirm，但 `novels/router.py:385`（import_persist）与 `novels/ai_backfill.py`（PRO）也写内嵌列表。import 有 reindex 计划，ai_backfill 未提 | §4.3 补一条：ai_backfill 是 PRO 流程，仍走旧写路径，读端已改 DB 不受影响；若执行 update_volume pop chapters，需确认 ai_backfill 不再依赖该键 |
| P2-L | **冗余计数漂移**：`projects.total_volumes/total_chapters` 手动维护，写路径漏一次即漂移；回填只自愈一次。表已存在，COUNT 代价极低 | 可选：list_all / novel_to_dict 改为从 volumes/chapters 表 COUNT 实时算，冗余列仅作缓存 |
| P2-M | **确认后编辑的 outline_status 降级语义**：refresh_chapter_meta 的 derive_outline_status 若每次保存都重算，confirmed 章被编辑后会降级为 in_progress 需重新确认。需明确是否符合预期（PRO 上下文合理，免费无感） | 在 PRD/共识 O4 口径下定义：编辑已确认章纲是否重置 outline_status |
| P2-N | **`create_volume` 当前 `project.total_volumes = vol_num`（直接赋值非 +1）**：body 传 5 时 total=5 但只建 vol-5.yaml（gap）。新 MAX+1 方案消除 gap，好；但需在兼容期处理旧数据 gap（回填按实际文件建行即可，`MAX(volume_no)+1` 与 gap 共存无碍） | 采纳 MAX+1；回填只按文件建行，不填 gap |

---

## 5. 风险补充（双写/回填/tier 旁路之外的新风险）

1. **free 模式阶段机矛盾（P0-1）是最大行为风险**：不止归档，任何 free 下非线性的 `update_phase` 调用都会 ValueError。建议在 tier.py 里把「free 不推进 current_phase（或 force 推进）」作为统一策略，而不是逐点修补。
2. **双写一致性窗口可接受，但 DB 刷新失败应降级而非 500**：YAML 已写、DB commit 失败时，`refresh_chapter_meta` 抛异常会让请求 500，而 YAML 是内容准、DB 靠懒补自愈。建议给 refresh 包 try/except + warning 日志，返回成功（YAML 已落），DB 行由读路径自愈兜底。
3. **SQLite 并发**：单用户桌面 + SSE 多并行流 + 3s debounce 自动保存可能并发 save_prose。`get_db` 每请求独立 session，SQLite 单写锁串行化，风险低；但 volumes.chapter_count / projects.total_chapters 的 `+=1` 需在同一 session 内与插章同 commit，避免读改写竞态。
4. **AI 流式写正文不经 save_chapter（P0-2）**：若 P1 落库而 PRO AI 写作仍可用，字数/状态会陈旧，是隐性回归；务必在 P1/P3 边界明示。
5. **GET /volumes 与 POST /chapters 的破坏性变更（P1-A/P1-B）**：现有前端与测试均依赖旧契约，改版必须同 commit 迁移，否则 CI 与线上 C 端断裂。

---

## 6. 对 D1–D5 偏离裁决的确认或异议

| # | 裁决 | 评审结论 |
| --- | --- | --- |
| D1 | volumes.name → **volumes.title** | **确认**。现状 API/YAML/前端 VolumeEditor/NovelPage 全用 title，改 name 需改 4 处调用方，纯成本无收益 |
| D2 | 四层骨架 → **扁平 service + repositories 查询模块** | **确认**。C 端 30+ 扁平路由模块，四层重构是无关大改，违背「精准修改」；repositories 仅作查询集中点，合理 |
| D3 | run-once 复用 backfill_status → **新增 projects.index_status** | **确认**。backfill_status 已被 AI step1/step2 占用（`workflow/router.py:148-204` 写入 step1_running/step1_done/…），复用会语义冲突 |
| D4 | 移除 archive require_ai_access + AI 摘要降级 | **确认且必要**，但**附带条件**：仅移除门控不够——必须同时解决 P0-1（archive 路由 update_phase 非法跃迁），否则免费归档仍 500。摘要降级（bare except → `full_text[:200]`）需同时捕获 `get_ai_client()` 的 ValueError 与 `client.chat` 异常，降级路径已验证可行 |
| D5 | 补挂 settings/ai_router.generate_field 的 require_ai_access | **确认**。源码确认 generate_all_settings 有挂、generate_field 漏挂，免费可绕过（G3） |

---

## 附：评审结论与落地优先级

- **本次交付可落地**，但落地顺序建议：P0-1（update_phase 旁路）→ P1（建表+回填+双写自愈+端点迁移）→ P2（UI&UX 改版）。
- 数据表设计与双写方案（YAML 先写、DB 后更、懒补、读路径自愈、INSERT-if-missing + index_status run-once）**成立**，与现有 composite_storage / migrate_settings_to_db 模式一脉相承，风险可算。
- 最大遗留争议：免费限 1 本（O1）是产品口径而非后端可行性问题，`require_project_limit` 现状实现正确，改不限只需删依赖或改 limit，后端零架构成本。
