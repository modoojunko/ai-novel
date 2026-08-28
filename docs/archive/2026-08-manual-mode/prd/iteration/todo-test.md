# 测试工作拆分（todo-test）

> 测试角色产出 · 2026-08-10
> 依据：`development-plan.md` v2（§3 前端要点 / §4 后端要点 / §5 数据表 / §7 任务 / §8 验收锚点）+ `tech-backend.md` §8 测试计划 + `reviews/consensus.md`（N1–N17 / B1–B10）
> 定位：把开发计划的**测试**工作拆成可执行 todo（TE-01…TE-29），供排迭代使用。每 todo 含：编号 / 标题 / 测试对象 / 关键断言（可执行验收）/ 前置依赖（对应 BE/FE 开发 todo）/ 归属。
>
> 测试金字塔原则：纯函数 → pytest 单测；HTTP 层 → pytest + FastAPI TestClient（integration）；React 组件/纯逻辑 → vitest（frontend-unit）；用户旅程 → Playwright（e2e）。**能下沉的不上提**——字数函数、gate 判定、token 口径是单测；门控旁路、双写一致性、树数据源是 integration；「建书即写→归档只读」闭环是 E2E。

---

## 1. 测试分层与命名约定

| 归属 (kind) | 工具 | 目录 | 说明 |
| --- | --- | --- | --- |
| `backend-unit` | pytest | `client/backend/tests/test_*.py` | 纯函数/服务层单测，无 HTTP；gate/tier/字数/derive 逻辑 |
| `integration` | pytest + `fastapi.testclient.TestClient` | `client/backend/tests/test_*.py` | HTTP + 临时 DB + 临时 DATA_ROOT；沿用 `conftest.py` 的 env 注入与 `_session_test_db` 建表基座 |
| `frontend-unit` | vitest + Testing Library (jsdom) | `client/frontend/src/**/*.test.{ts,tsx}` | 组件/纯逻辑单测；`vitest.config.ts` 已就绪（jsdom + `src/test-setup.ts`） |
| `e2e` | Playwright | `client/frontend/e2e/*.spec.ts` | 免费主流程用户旅程；沿用 `playwright.config.ts`（`E2E_BASE_URL` 覆盖、trace on-first-retry、CI retries=1、workers=1） |

**关键约定（确定性）**：
1. **无硬睡眠**。等待条件：web-first 断言（`toBeVisible`/`toHaveText`）、`waitForResponse`、`page.clock`/vi fake timers。禁用 `waitForTimeout` 定时空转。
2. **测试拥有自己的数据**。每测试独立注册 S端 用户 / 独立 config.json 会话 / 唯一书名（现有 `creation-flow.spec.ts` 的 `setupSession`/`writeOAuthSession` 范式直接复用）。
3. **Role/test-id 选择器**。`getByRole('button', { name: '…' })` 优先；仅语义够不到时用 `data-testid`。新组件（`WritingTree`/`ProseEditor`/`BottomStatusBar`）关键锚点落 `data-testid`。
4. **E2E 只跑真实旅程**。设定 7 项确认等既有 E2E 保留回归；新增 E2E 聚焦免费主流程闭环，不复刻单测可证内容。
5. **新测试交付前 `--repeat-each=10` 本地连绿**；集成测试同 `python -m pytest tests/test_xxx.py`。

---

## 2. 测试基础设施前置（先行交付，非独立 todo）

1. **tier 操纵 fixture**（P0-2 的测试前提）：`tests/conftest.py` 增加 `set_tier(tier, expires_at=None)` 帮助函数——写 `DATA_ROOT/config.json` 并配合 `get_local_config` 缓存刷新；TE-02/TE-03/TE-05 依赖。现状 `auth_local/service.py::get_local_config` 读 `config.json`（tier 字段），`check_permission` 据 tier 返回 `{allowed, tier, project_limit, trial_remaining_days}`。
2. **共用字数函数（TE-11）**：P0-1 定稿 `countChars`（去空白中文字符数）后，前端 `lib/` 导出、后端 `workflow/`（或 `utils`）导出同一实现；两侧单测对同一样例断言同输出，作为「口径统一」的可执行验收。
3. **S端 会话 helper 复用**：现有 `creation-flow.spec.ts` 的 `sRegisterAndLogin`/`writeOAuthSession`（S端 19000 签发 JWT → 写 docker `config.json`）已是成熟范式，新 E2E 直接提取复用；免费态需把 `cfg.tier` 写 `"none"`。

---

## 3. Todo 拆分

> `依赖` 引用 `development-plan.md` §7 的任务编号（P0-x / P1-x / P2-x）。文件路径均为相对 `client/` 的相对路径。

### 3.1 P0 域 — tier 门控旁路 + 归档免费化（后端）

#### TE-01 · workflow/tier.py 门控旁路单元测试
- **测试对象**：`backend/workflow/tier.py`（新增：`tier_bypass` / `tier_or_gate` / `tier_phase_transition`）
- **关键断言（可执行验收）**：
  1. `tier_bypass("none") is True`；付费 tier（`monthly/quarterly/yearly` 未过期）`is False`；**过期付费**（`check_permission` 返回 `allowed=False`，N9/BE P2-I）也旁路 `is True`。
  2. `tier_or_gate` free 分支：gate_fn 不 invoke（mock 未调用），返回 `valid=True`。
  3. `tier_or_gate` PRO 分支：invoke gate_fn，原样返回其 `GateResult`（含 `hard_block`）。
  4. `tier_phase_transition` free 下：`update_phase(project, "archive")` 从 `current_phase="settings"` 走 force 旁路**不抛 ValueError**（免费归档 500 根因 N9）；PRO 下同场景仍抛。
  5. PRO 下合法流转（outline→prompt）不受旁路影响。
- **前置依赖**：BE P0-2
- **归属**：backend-unit

#### TE-02 · free 全闸门通过 + phase-status tier_bypass（HTTP 集成）
- **测试对象**：`workflow/tier.py` 各接入点（`create_volume`/`confirm_chapter`/`workflow/transition`）+ `GET workflow/phase-status`
- **关键断言**：
  1. `tier="none"`：空 memo/segments 章 `POST /chapters/{ref}/confirm` → **200**（现状 400，`gate_chapter_ready` hard 拦截）；`transition {target:"write"}` 无 prompt 文件 → **200**（现状 400，`gate_prompts_exist` 拦截）；`create_volume` 无设定 → 通过（soft gate 本就不拦，回归断言不回归）。
  2. free：`phase-status` 返回 `tier_bypass: true` + `phases` 全 `complete`（不展示不催促）。
  3. PRO（monthly 未过期）：上述确认/流转仍被 gate 拦截 → 400（tier 旁路只在 free/过期生效，防误伤 PRO 语义）。
  4. 过期付费（tier=yearly + expires_at 过去）：等同 free 旁路（BE P2-I）。
- **前置依赖**：BE P0-2（+ §2.1 tier fixture）
- **归属**：integration

#### TE-03 · 归档免费化：无 API Key 可归档、不 500
- **测试对象**：`archive/service.py`（AI 摘要降级）+ `archive/router.py`（移除 `require_ai_access`）+ `workflow/engine.update_phase` 旁路
- **关键断言**：
  1. 无 API Key（不 override `require_ai_access`，config.json 无 `api_key`）：`POST /chapters/{ref}/archive` → **200，不 500**（现状 `get_ai_client()` 无 Key 抛 500，B2）；`GET /archives` / `GET /archives/{filename}` 免费可读 → 200。
  2. **AI 摘要降级**：mock `get_ai_client()` 抛 `ValueError`/`client.chat` 异常 → 归档仍成功，`archive_summary == 正文首 200 字`（BE B2/D4）。
  3. **N9 旁路**：新书（`current_phase="settings"`）建章后直接归档 → 200，不因 `update_phase("archive")` 非法跃迁 500。
  4. 归档后 DB `chapters.status=='archived'` + `archived_at` 写入；YAML `status=='archived'`；归档文件为 `archives/vol-N-ch-M-*.md`。
  5. **B4 修复回归**：归档后 `phase-status` 的 `archive` 阶段不再恒 `in_progress`（`gate_archived` 改从 DB `chapters.status=='archived'` COUNT，不再查 `.yaml`）。
- **前置依赖**：BE P0-2、P0-3
- **归属**：integration

#### TE-04 · unarchive 归档可逆（N6）
- **测试对象**：`POST /chapters/{ref}/unarchive`（或同归档端点 status 回退，BE P2 级）
- **关键断言**：
  1. 归档章 unarchive → `status` 回 draft/outline、`archived_at` 清空、YAML status 同步。
  2. unarchive 后 `GET /chapters/{ref}` 可读且 `prose` 完整；树节点 📦 徽标消失（E2E 侧 TE-26 联动）。
- **前置依赖**：BE P2-6（unarchive 端点）
- **归属**：integration

#### TE-05 · AI 端点 403 门控补全（D5 修复回归）
- **测试对象**：`settings/ai_router.py::generate_field`（`POST /settings/ai/{type}/{field}` 现状漏挂 `require_ai_access`，D5）+ `/settings/generate` + `/ai/*`
- **关键断言**：
  1. 无 Key 免费态直呼 `POST /settings/ai/{type}/{field}` → **403**（补挂后不再可达）。
  2. `POST /settings/generate`、`POST /api/ai/suggest-meta` 等 AI 端点 free/无 Key → 403（现有门控回归）。
  3. PRO 且已配 Key → 仍可达（不误伤）。
- **前置依赖**：BE P0-6
- **归属**：integration

### 3.2 P1 域 — 数据底座 + 双写一致性（后端）

#### TE-06 · volumes/chapters 模型 + 建表
- **测试对象**：`models/volume.py`、`models/chapter.py`、`models/project.py`（`index_status` + `Volume.chapters` relationship cascade）
- **关键断言**：
  1. `Base.metadata.create_all` 建出 `volumes`/`chapters` 表（`conftest._session_test_db` 自动受益）。
  2. `projects.index_status` 默认 `'none'`。
  3. 删卷 → 级联删章行（relationship `cascade="all, delete-orphan"` + ORM FK `ondelete="CASCADE"` 双保险，BE 3.2）；SQLite 需开 `PRAGMA foreign_keys` 断言真实 DB 级级联。
  4. `chapters` 唯一约束：同项目 `UNIQUE(project_id, ref)`；`UNIQUE(project_id, volume_no)` 撞号报错。
- **前置依赖**：BE P1-1
- **归属**：integration（轻量，可并 TE-07）

#### TE-07 · 幂等回填 index_volumes_chapters
- **测试对象**：`filesystem/index_volumes_chapters.py` + `novels/router.import_persist` 调 `reindex_project`
- **关键断言**：
  1. **幂等**：对同一 `DATA_ROOT` 跑两遍回填，`volumes`/`chapters` 行数不变（INSERT-if-missing）。
  2. **run-once**：`index_status != 'done'` 才跑，跑完置 `done`；重启幂等（B1/BE 4.2）。
  3. **孤儿章文件兜底**：`chapters/*.yaml` 有文件但无卷行 → 建占位卷 + 章。
  4. **import 项目**：`import_persist` 后调 `reindex_project`，`GET /volumes` 立即可列出（不等重启）。
  5. **冗余计数自愈**：`project.total_volumes/total_chapters` == `COUNT(volumes/chapters)`。
  6. **B1 口径**：内嵌列表 `word_count` 不可信，以 `chapters/{ref}.yaml` 的 `prose` 重算。
  7. **只增不删**：文件缺失的孤儿 DB 行不清理（写路径保证同步）。
- **前置依赖**：BE P1-2、P1-1
- **归属**：integration

#### TE-08 · 卷 CRUD 双写一致性（DB + YAML）
- **测试对象**：`volumes/service.py` + 卷端点（`GET/POST/PUT/DELETE /volumes`、`{ref}` 容 `.yaml`）
- **关键断言**：
  1. `POST /volumes`：写 `volumes/vol-N.yaml` + 插 DB 行；`volume_no = MAX+1` 且**忽略 body.vol_num**（B9，撞号不再 400/500）；`total_volumes` 维护。
  2. `GET /volumes`：**DB 查询**返回全量卷+章树元数据（含 `has_prose/archived/outline_status`），不再文件扫描；响应形状为 breaking change 后的新契约（N11）。
  3. `PUT /volumes/{ref}`：`title/summary` **双写 DB 行 + YAML**；其余 key（结构模板/冲突阶梯/…）只写 YAML；`chapters` 键 `pop` 清派生快照（§4.3，消除双写漂移源 G1）。
  4. `DELETE /volumes/{ref}`：删 DB 行（级联删章）→ 删 vol YAML + 章 YAML + `versions/{ref}/` + `archives/vol-N-*.md`；`total_volumes/total_chapters` 维护。
  5. `{ref}` 尾缀 `.yaml` 容错：`GET/PUT/DELETE /volumes/vol-1.yaml` 与 `/volumes/vol-1` 等价。
- **前置依赖**：BE P1-3、P1-1、P1-2
- **归属**：integration

#### TE-09 · 章 CRUD 双写一致性
- **测试对象**：`chapters/service.py` + 章端点（`POST /volumes/{ref}/chapters`、`GET/PUT /chapters/{ref}`、`PUT /chapters/{ref}/prose`、`DELETE /chapters/{ref}`）
- **关键断言**：
  1. 卷内建章（新端点替代旧 `POST /chapters`）：`chapter_no = MAX+1`；写 `chapters/{ref}.yaml` + 插 DB 行 + `volumes.chapter_count += 1` + `projects.total_chapters += 1`（同 session 同 commit，防读改写竞态）；**不再写 vol YAML 内嵌 chapters 列表**。
  2. `GET /chapters/{ref}`：YAML 内容 + DB 元数据合并返回；DB 行缺失 → **`ensure_volume_row` 懒补（卷行前置，B10）** + 插章行。
  3. `PUT /chapters/{ref}`：走 `engine.save_chapter` + `refresh_chapter_meta`；**refresh 以 `load_chapter` 重读 YAML 为准**，只覆盖本次变更字段，不整行覆盖 payload 缺省字段（P1-C）。
  4. `PUT /chapters/{ref}/prose`（编辑器自动保存专用，新增）：body `{prose}` → 写 YAML + 版本快照 + 刷新 `word_count/has_prose`。
  5. `DELETE /chapters/{ref}`：删 YAML + DB 行 + `versions/{ref}/`；`chapter_count/total_chapters` 维护。
  6. 权限：跨用户访问他书章 → 404（所有权隔离）。
- **前置依赖**：BE P1-4、P1-1、P1-2、P0-2
- **归属**：integration

#### TE-10 · 双写一致性专项（DB 元数据 vs YAML 内容）
- **测试对象**：`refresh_chapter_meta` / `ensure_volume_row` / 读路径自愈 / `versions.restore` 刷新
- **关键断言**：
  1. `save_chapter`/`save_prose` 后 DB `word_count/has_prose/title/status/outline_status/updated_at` 正确（与 YAML 一致）。
  2. **YAML 仍为内容唯一属主**：`prose` 只存在于 YAML，DB 不存正文；断言行数/快照未分裂。
  3. **DB 失败降级不 500**：mock `refresh_chapter_meta` 抛异常 → 接口仍 200（YAML 已落），warning 日志；读路径自愈（`GET /chapters/{ref}` 懒补）。
  4. **懒补统一收口**：DB 无卷行时 `ensure_volume_row` 先 upsert 卷行再插章行（B10）。
  5. `versions/restore` 后刷新 `word_count/has_prose/status/outline_status/confirmed_at`（P2-H）。
- **前置依赖**：BE P1-4、P1-5
- **归属**：integration

#### TE-11 · word_count 口径统一（去空白中文字符数）
- **测试对象**：前后端共用字数函数（对齐 `countChars`）
- **关键断言**：
  1. 单测：`"我 爱你 "`（含空白）→ 去空白后 `4`；空串/纯空白 → `0`；中文 + 标点计数正确（与编辑器 `countChars` 同规则，B5/P2-J）。
  2. 跨层一致性：`PUT /chapters/{ref}/prose` 保存后 DB `word_count` == 前端 `countChars(prose)` 对同一输入的输出。
  3. `/tree`（GET /volumes）返回的 `word_count` 与正文保存同口径（修复 B5 `/tree` 用 `len(prose)` 含空白的漂移）。
- **前置依赖**：BE P2-J（字数函数落位）、FE P2-1
- **归属**：backend-unit + frontend-unit（同一断言两侧各跑）

#### TE-12 · 树数据源切 DB（GET /volumes 全量树 + has_prose）
- **测试对象**：`novels/service.build_project_tree` 改 DB + `volumes` 端点
- **关键断言**：
  1. `GET /tree` / `GET /volumes` 返回 DB 树，章元数据含 `{ref, title, status, word_count, has_prose, archived, outline_status}`。
  2. 空章 `has_prose=false`；保存正文后 `has_prose=true`；归档章 `archived=true` 且恒返回（过滤在前端 N1，后端返回全量不过滤）。
  3. `import_persist` 后树立即可查（reindex 联动，TE-07 复用断言）。
  4. 前端 `useOutline` 在零改动下消费新契约（N11 同 commit 迁移验证）。
- **前置依赖**：BE P1-5、P1-3
- **归属**：integration

#### TE-13 · test_readiness.py breaking change 迁移（N11）
- **测试对象**：现有 `tests/test_readiness.py` + 前端 `NovelPage.loadVolumes` 契约迁移
- **关键断言**：
  1. `POST /chapters` 被 `POST /volumes/{ref}/chapters` 替代后，`test_readiness.py`/`test_workflow_api.py` 全部迁移到新契约并全绿（**同 commit**，N11）。
  2. `GET /volumes` 响应形状变更后，既有断言（卷 `filename/ref` 解析）更新且全绿。
  3. 迁移后旧契约端点返回 404/405（不再双轨）。
- **前置依赖**：BE P1-5（含 breaking change 同 commit）
- **归属**：integration（回归迁移）

#### TE-14 · write/_stream_chapter 补 refresh_chapter_meta（N10）
- **测试对象**：`write/router._stream_chapter`（AI 流式写正文路径）
- **关键断言**：mock AI 流式写入后，DB `word_count/has_prose/status` 立即刷新（P1 落库后 AI 写作字数/状态不陈旧）；`GET /volumes` 树同步反映最新字数。
- **前置依赖**：BE P1-6、P1-4
- **归属**：integration

### 3.3 P0/P2 域 — 前端（unit + e2e）

#### TE-15 · LicenseProvider / useTier / lib/features.ts / FeatureTier
- **测试对象**：`frontend/src/license/LicenseProvider.tsx`、`lib/features.ts`、`license/FeatureTier.tsx`
- **关键断言**：
  1. `useTier` 缓存 `/auth/verify`，下发 `{tier, isFree, isPro}`；`tier==="none"` → `isFree=true`。
  2. 能力清单（§3.4/tech-frontend §5.1）：`tree-crud/prose-edit/version-history/archive/volume-chapter-config/advanced-config-entry/settings-7-items` 免费 `true`；`settings-ai-fields/outline-advanced-fields/ai-generate/prompt-panel/ai-model` 免费 `false`。
  3. `<TierGate feature>`：免费态不渲染子内容；PRO 态渲染。
  4. `<TierField feature locked>`：免费态渲染锁定态（🔒/隐藏文案）。
- **前置依赖**：FE P0-4
- **归属**：frontend-unit

#### TE-16 · NovelWorkspace 四态视图机（Workbench 常驻）
- **测试对象**：`frontend/src/components/novel/NovelWorkspace.tsx`
- **关键断言**：
  1. 默认落点 `workbench`（写作恒为主界面，C5）。
  2. `workbench → advanced-settings → workbench`：**正文脏状态（未到防抖窗口的输入、光标）不丢**——Workbench 常驻挂载 + `hidden` 切换，非卸载（§3.1）。
  3. advanced/archives 首次访问懒挂载、离开卸载。
- **前置依赖**：FE P0-5、P0-7
- **归属**：frontend-unit + e2e

#### TE-17 · 免费主流程 E2E 闭环（建书即写→树 CRUD→抽屉→自动保存→字数→归档只读→状态同步）
- **测试对象**：免费主流程全旅程（N1 显式验收）
- **关键断言**（均为 E2E 可见行为）：
  1. 免费建书（tier=`none`）→ **直达正文工作台可写**（不落 settings、无「先去设定」引导）。
  2. 树「+ 新建卷」→「+ 新建章」→ 新建「第一章」**即达编辑器**（N1）；空章「未写」弱化可见、不过滤。
  3. 树 hover：配置/重命名/删除（N2）——重命名后树 + 面包屑同步；删除后树移除 + 计数同步。
  4. 卷/章抽屉（摘要级）打开 → 卷名+摘要 / 章名+摘要+**目标字数**（N5）保存 → 树同步、进度条目标更新。
  5. 写作输入 → 1.5s 自动保存 → 「已自动保存 ✓」；底部字数实时更新；保存失败出现「重试」。
  6. 归档本章 → 编辑器只读 + `ArchiveBanner` + 树 📦 徽标 + 进度定格。
  7. 主工作台可见「高级配置 ▾」（N3）；**全程无 AI 字段 / 无提示词 / 无阶段催促 UI**（PRO 容器 N14）。
  8. 状态同步：归档/重命名后 `GET /volumes` 树与 UI 一致（跨请求断言）。
- **前置依赖**：FE P0-7、P0-8、P2-1、P2-2、P2-3、BE P1-4（prose 端点/树 DB）
- **归属**：e2e

#### TE-18 · contenteditable ProseEditor 受控回写 + 游标不跳
- **测试对象**：`frontend/src/components/novel/ProseEditor.tsx` + `lib/selectionContentEditable.ts`
- **关键断言**（N8 策略，前端单测可证）：
  1. **DOM→state 单向**：`onInput` 只序列化到 state；state 变化**不重渲染编辑器 DOM**（载入/`setPlainText()` 之外不写 `innerHTML`）——断言载入后输入若干字符，光标位置不回跳、DOM 未被 React 重建。
  2. 段落序列化：prose 纯文本按 `\n\n` 拆段渲染 `<p>`；段内换行拍平；序列化输出纯文本（无 HTML 写回 YAML）。
  3. `getPlainText()` 与 `setPlainText()` 往返一致；`captureNow()` 返回纯文本 `{start, end}` 偏移。
  4. `countChars` 与存储同一纯文本（TE-11 口径）。
- **前置依赖**：FE P2-1（N8 策略 P0-1 定稿）
- **归属**：frontend-unit（jsdom 模拟 contenteditable）+ e2e（TE-17 覆盖游标可用）

#### TE-19 · IME 守卫 + 粘贴净化
- **测试对象**：`ProseEditor` 的 `onCompositionStart/End` 与 `onPaste`
- **关键断言**：
  1. composition 进行中（`onCompositionStart` 后、`onCompositionEnd` 前）：不序列化、不触发防抖保存（断言定时器未排程）。
  2. 中文输入完整：选词期间中途快照不丢字（结束事件后序列化结果 = 完整词组）。
  3. 粘贴净化：`onPaste` 拦截，白名单 `p/br/strong/em` 之外全部剥离 → 转纯文本/段；`<script>`/`<div>`/样式内联不进入 prose。
- **前置依赖**：FE P2-1
- **归属**：frontend-unit（vi 构造 composition 事件 + clipboardData）

#### TE-20 · 自动保存（1.5s 防抖 + 保存四态 + 重试）
- **测试对象**：`hooks/useChapterData.ts`（+ `ProseEditor` 联动）
- **关键断言**（vi fake timers）：
  1. 停止输入 1500ms → 触发保存请求（`PUT /chapters/{ref}/prose` 或同一写端点，N11 契约）；连续输入不重复触发（防抖）。
  2. **保存四态**：自动保存中 → 已保存 ✓ → 未保存（dirty）→ 失败；失败态出现「重试」按钮，点击重发成功回落「已保存」。
  3. 卸载/切章 flush 未落盘改动（`isDirty` 时补发）。
  4. 归档态（`status==='archived'`）不触发保存（contentEditable=false）。
- **前置依赖**：FE P2-1、P2-2、BE P1-4（prose 端点）
- **归属**：frontend-unit + e2e

#### TE-21 · 字号/行距/专注模式
- **测试对象**：`EditorToolbar.tsx` + `Workbench.tsx`（focusMode）
- **关键断言**：
  1. 字号 15/17/19px、行距 1.8/2.0/2.2，默认 17px/2.0；以 CSS 变量作用于容器（`--prose-size/--prose-leading`），无每段内联样式。
  2. 偏好持久化 `localStorage`：刷新后记忆。
  3. 专注模式：隐藏左树 + 工具条；**保留面包屑栏与底部状态栏**（C4/C6）；`Esc` 退出（失焦态也可用，R4）。
- **前置依赖**：FE P2-1、P2-2
- **归属**：frontend-unit + e2e

#### TE-22 · BottomStatusBar（字数 + 保存四态 + 内嵌进度条）
- **测试对象**：`BottomStatusBar.tsx`
- **关键断言**：
  1. 实时字数/目标同排；进度百分比 = `当前/目标` 正确。
  2. 目标字数可调（来自章抽屉 N5），调整后进度条实时更新。
  3. 设定 n/7 进度：画 7 项、JS 按 7 计算、显示 n/7；`7/7` 换 `progress-success`（O5 修复验收）。
- **前置依赖**：FE P2-2、P2-3
- **归属**：frontend-unit + e2e

#### TE-23 · 卷/章配置抽屉 + N16 双轨打通
- **测试对象**：`VolumeConfigDrawer.tsx` / `ChapterConfigDrawer.tsx`
- **关键断言**：
  1. 抽屉互斥（开卷不叠章）、事件不冒泡到树。
  2. 卷名+摘要保存 → `PUT /volumes/{ref}` → 树/面板同步；章名+摘要+目标字数保存 → 同步。
  3. 「去写正文」→ 编辑器定位该章；「完整字段 →」→ 跳 `advanced-outline` 并高亮定位节点（N16）。
  4. **双轨共用 chapterData 缓存**：抽屉与高级面板打开前 flush/refetch，防 merge 覆盖（R3）。
- **前置依赖**：FE P2-3、P1-4
- **归属**：frontend-unit + e2e

#### TE-24 · AdvancedSettingsView（7 项 + n/7 + 三态徽标 + tier 显隐）
- **测试对象**：`AdvancedSettingsView.tsx`
- **关键断言**：
  1. 展示口径固定 7 项：题材/简介/世界/风格/反AI味/伏笔/角色；**ai-model 移出树、synopsis 为树节点**（N12）；顶部「设定 n/7」。
  2. **O5 修复**：画 7 项、JS 按 7 计算、显示 n/7，条宽与标签同口径（UI H1）。
  3. 题材级配置**免费可填 + PRO 消费**（O6）：免费态题材配置文本可编辑，AI 填充入口隐藏。
  4. 免费态「必填」→「建议填写」（N4）；PRO 字段 `TierField` 🔒/隐藏。
  5. 三态徽标 ghost/warning/success（N15），synopsis 卡不重复渲染（N12 防重）。
- **前置依赖**：FE P2-4
- **归属**：frontend-unit + e2e

#### TE-25 · AdvancedOutlineView 卷/章全字段面板
- **测试对象**：`AdvancedOutlineView.tsx` + `VolumeConfigPanel.tsx` + `ChapterConfigPanel.tsx`
- **关键断言**：
  1. 卷面板净新增表单（结构模板/冲突阶梯/信息差/场景卡）保存 → `PUT /volumes/{ref}` 其余 key 只写 YAML（TE-08 联动）。
  2. 章面板复用 `OutlineEditor` 右面板形态；缺字段就地提示 + 跳转高亮；批量确认。
  3. **状态语言四态唯一**（N15）：未填 ○/进行中 ●/已确认 ✓/已归档 📦，统一 badge 胶囊；写作状态（字数+归档）与章纲状态（outline_status）分离不同屏（O4）。
- **前置依赖**：FE P2-5、P1-4
- **归属**：frontend-unit + e2e

#### TE-26 · archives 视图 + 归档可逆（N6）
- **测试对象**：`ArchivesView`（接线 `ArchivePage/ArchiveReader`）+ unarchive 入口
- **关键断言**：归档列表免费可读；只读阅读正文；「取消归档，继续编辑」→ 编辑器恢复可编辑 + 树 📦 徽标消失 + 进度恢复（联动 TE-04 端点）。
- **前置依赖**：FE P2-6、BE P2-6（unarchive 端点）
- **归属**：e2e

#### TE-27 · 高保真四页对齐 + token 双主题（N7）
- **测试对象**：01-list / 02-writing / 03-settings / 04-outline 逐页 + mockup→token 映射 + 亮/暗主题
- **关键断言**：
  1. 01-list：O1 显式化——创建弹窗「免费 = 完整人工写作能力（限 1 部作品）」提示 + 升级锚点；列表满额显示「已用 1/1，升级解锁更多」而非隐藏入口。
  2. 02-writing：两栏（左树 + 右编辑器）+ 底部进度条（N13/C6，无常驻右栏）。
  3. 03-settings：7 项渲染无 bug（O5 验收）；04-outline：免费态字段显隐蓝本。
  4. token 映射：amber→primary 等落 token，无硬编码色板；亮/暗主题切换后组件全部落在 token（S1/N7）。
  5. 对比度 WCAG AA（功能文本 ≥4.5:1）；树/抽屉 a11y：focus-within 可发现、Esc、焦点管理。
- **前置依赖**：FE P2-7、P2-8
- **归属**：e2e + frontend-unit（主题 token / 对比度可在 jsdom 断言 class 与样式变量）

#### TE-28 · WritingTree 树 CRUD + 过滤（N1/N2）
- **测试对象**：`WritingTree.tsx`（包装 `StructureTree`）
- **关键断言**：
  1. 行内「+ 新建卷」/「+ 新建章」渲染；新章即选中达编辑器（N1）。
  2. 空章「未写」弱化（弱化 class/样式），不硬过滤；`has_prose` 过滤在前端基于后端全量（N1）。
  3. hover 显示 配置/重命名/删除 入口（N2）；重命名/删除调用对应 CRUD 端点并刷新树。
  4. 字数/归档徽标：有 prose 显示字数；归档章 📦。
- **前置依赖**：FE P0-7
- **归属**：frontend-unit + e2e

#### TE-29 · 免费/PRO 两态渲染（N14 PRO 容器）
- **测试对象**：`NovelWorkspace` 免费态顶层不渲染 PRO 子树 + AI 面隐藏
- **关键断言**：
  1. 免费态：`TabProgressButton/GateBanner/OnboardingCard` 顶层不渲染（无 DOM）；**不请求 `phase-status`**（`fetchPhaseStatus` 不触发，杜绝 hook 条件调用）。
  2. 免费态：无「AI 生成正文」按钮、无 prompt tab、无质量检查入口、无 `RightToolbar` AI 面。
  3. PRO 态（mock tier=paid）：上述子树与 AI 面恢复渲染（代码保留未删）。
- **前置依赖**：FE P0-5、P0-6
- **归属**：frontend-unit + e2e

---

## 4. 依赖映射（dev-plan 任务 → TE）

| dev-plan 任务 | 对应 TE | 说明 |
| --- | --- | --- |
| P0-2（tier 旁路层） | TE-01、TE-02、TE-03(3) | 单测 → HTTP 集成 → 归档 N9 旁路 |
| P0-3（归档免费化） | TE-03、TE-04 | 摘要降级 + 免费可读 + unarchive |
| P0-4（两态地基） | TE-15 | LicenseProvider/features 单测 |
| P0-5/P0-6（PRO 容器 + AI 隐藏） | TE-29、TE-05 | 渲染层 + 端点 403 补全 |
| P0-7/P0-8（免费主流程纵切/闭环） | TE-16、TE-17、TE-28 | 视图机 + E2E 闭环 + 树 CRUD |
| P1-1（建表） | TE-06 | 模型/级联/约束 |
| P1-2（回填） | TE-07 | 幂等/run-once/孤儿/计数自愈 |
| P1-3（卷端点） | TE-08 | 卷 CRUD 双写 |
| P1-4（章端点） | TE-09、TE-10、TE-14、TE-20 | 章 CRUD + 双写一致性 + prose 保存 |
| P1-5（树 DB + breaking change） | TE-12、TE-13 | 树数据源 + test_readiness 迁移 |
| P1-6（_stream_chapter refresh） | TE-14 | N10 |
| P2-1（ProseEditor） | TE-18、TE-19、TE-11(前端) | 受控回写 / IME / 粘贴 / 字数口径 |
| P2-2（Toolbar/StatusBar） | TE-20、TE-21、TE-22 | 保存四态 / 字号行距 / 进度条 |
| P2-3（抽屉） | TE-23 | 摘要抽屉 + 双轨打通 |
| P2-4（设定视图） | TE-24 | 7 项 / n/7 / tier 显隐 |
| P2-5（大纲视图） | TE-25 | 全字段面板 + 状态四态 |
| P2-6（archives 可逆） | TE-26 | 归档只读 + unarchive 入口 |
| P2-7/P2-8（token/四页对齐/E2E 补测） | TE-27 | 高保真验收 + E2E |

**并行注意**：TE-17 为端到端闭环，依赖后端子模块（P1-4 的 prose 端点 + 树 DB）就位才可全绿；在此之前可先用「降级过滤」路径（P0-7 R11）跑通并标注待补断言。

## 5. 交付顺序建议（测试自身可独立先行）

1. **地基**：§2 基础设施（tier fixture、字数函数、会话 helper）。
2. **P0 后端**：TE-01 → TE-02 → TE-03 → TE-05（门控 + 归档 + 403，纯后端可并行开工）。
3. **P1 后端**：TE-06/07 → TE-08 → TE-09/10 → TE-11 → TE-12/13 → TE-14。
4. **P0/P2 前端**：TE-15 → TE-29 → TE-16 → TE-28 → TE-18/19 → TE-20/21/22 → TE-23/24/25 → TE-26 → TE-27。
5. **闭环 E2E**：TE-17 最后接入（前置最重），验收对齐 `development-plan.md` §8 P0/P1/P2。

## 6. 验收口径（对齐 development-plan §8 锚点）

- **P0 通过** = TE-01/02/03/05/17/28 绿：免费建书直达工作台、树 CRUD + 抽屉 + 自动保存 + 归档只读、全程无 AI 字段/提示词/阶段 UI、AI 端点 403、归档不 500。
- **P1 通过** = TE-06~14 绿：卷/章元数据入 DB、回填幂等、树/字数/归档态走 DB、YAML 内容唯一属主、breaking change 迁移完成、后端测试套件全绿（现有 66 条 + 新增）。
- **P2 通过** = TE-18~27 绿：contenteditable 无游标跳/IME 损坏、高级配置独立视图、状态四态唯一、token 双主题、01–04 四页对齐、E2E 免费主流程通过。
