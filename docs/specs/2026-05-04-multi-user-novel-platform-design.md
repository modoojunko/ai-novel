# Multi-User Novel Writing Platform — Design Spec

## Overview

从 awesome-novel skill（单用户、文件系统、Claude Code 内交互）改造为 SaaS 多用户 Web 平台。用户注册、创建小说项目、通过 6 Phase 工作流与 AI 协作写作，按 token 用量收费。

---

## 1. System Architecture

```
User Browser
     │
     ▼
┌──────────┐
│  Nginx   │  (HTTPS, /api/* → FastAPI, 其余 → Next.js)
└────┬─────┘
     │
     ├── /api/* ──► FastAPI (uvicorn, asyncio)
     │                  │
     │                  ├── Auth: register/login/JWT
     │                  ├── Projects CRUD
     │                  ├── Workflow Engine (Phase 1→6)
     │                  ├── Prompt Assembler (Phase 4)
     │                  ├── Streaming Proxy (SSE → Anthropic)
     │                  ├── Billing / Token Tracking
     │                  │
     │                  ├──► PostgreSQL (user data, project metadata)
     │                  └──► File System (/data/{user_id}/{project}/)
     │
     └── 其余 ──► Next.js 14 (React + shadcn/ui)
                      │
                      ├── Dashboard (project list)
                      ├── Project Workspace
                      │   ├── Settings Editor (Phase 2)
                      │   ├── Outline Board (Phase 3)
                      │   ├── Prompt Viewer (Phase 4)
                      │   └── Writing Studio (Phase 5 — multi-pane streaming)
                      └── Archives Reader (Phase 6)
```

No Redis, no Celery. Streaming via SSE, asyncio throughout.

---

## 2. Data Layer (for real)

### 2.1 PostgreSQL — System Data Only

Four tables. That's it.

#### users

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- billing
    token_balance  BIGINT NOT NULL DEFAULT 0,       -- remaining tokens
    total_tokens   BIGINT NOT NULL DEFAULT 0,       -- lifetime tokens used
    plan           TEXT NOT NULL DEFAULT 'free'      -- free | pro | unlimited
);
```

#### projects

```sql
CREATE TABLE projects (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL,                          -- filesystem-safe name
    root_path  TEXT NOT NULL,                          -- e.g. /data/{user_id}/{slug}/

    current_phase  TEXT NOT NULL DEFAULT 'init',       -- init|settings|outline|prompt|write|archive
    status         TEXT NOT NULL DEFAULT 'active',     -- active|archived|deleted

    -- quick glance counters
    total_volumes   INT NOT NULL DEFAULT 0,
    total_chapters  INT NOT NULL DEFAULT 0,
    total_archives  INT NOT NULL DEFAULT 0,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, slug)
);
```

#### token_log

```sql
CREATE TABLE token_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    project_id  UUID REFERENCES projects(id),
    chapter_id  TEXT,                                   -- "vol-3-ch-15-seg-2"

    operation   TEXT NOT NULL,                          -- 'generate_outline' | 'write_prose' | 'review' | 'archive'
    model       TEXT NOT NULL DEFAULT 'haiku',
    tokens_in   INT NOT NULL,
    tokens_out  INT NOT NULL,
    cost_cents  INT NOT NULL,                           -- fractional cents as integer (1 = 0.01 USD)

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_log_user ON token_log(user_id, created_at DESC);
```

#### sessions (JWT refresh)

```sql
CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL UNIQUE,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

That's the entire SQL schema. Novel data lives on disk.

---

### 2.2 File System — Novel Data

Exactly mirrors the current awesome-novel project skeleton.

```
/data/projects/{user_id}/{project_slug}/
├── story.yaml                          # project index
├── author-intent.md
├── current-focus.md
├── settings/
│   ├── world-setting.yaml
│   ├── writing-style.yaml              # genre config + skill_layers
│   ├── anti-ai.yaml                    # AI fatigue word blocklist + rules
│   ├── hooks.yaml                      # foreshadowing lifecycle
│   └── character-setting/
│       ├── zhang-san.yaml
│       └── li-si.yaml
├── volumes/
│   ├── vol-1.yaml
│   └── vol-2.yaml
├── chapters/
│   ├── vol-1-ch-1.yaml
│   ├── vol-1-ch-2.yaml
│   └── vol-2-ch-1.yaml
├── threads.yaml                        # NEW: multi-thread timeline tracking
├── prompts/
│   ├── vol-1-ch-1-seg-1-prompt.md
│   └── vol-1-ch-1-seg-2-prompt.md
└── archives/
    ├── vol-1-ch-1-deep-night-visitor.md
    └── vol-1-ch-2-rain-alley.md
```

---

### 2.3 Key YAML Structures (Novel Data)

#### chapter.yaml (extended for multi-thread + memory)

```yaml
# chapters/vol-3-ch-15.yaml
volume: 3
chapter: 15
title: "仓库暗影"

# ── thread / timeline (NEW) ──
pov_character: "顾辰"              # whose POV
thread: "卧底线"                   # which narrative thread
story_time: "第3卷第4天 凌晨2点"    # in-story timestamp
concurrent_with:                   # chapters happening at same story-time
  - "vol-3-ch-10"                  # B-line at the banquet
crossover_ref: "vol-2-ch-8"       # last A/B meetup chapter

# ── outline ──
outline:
  summary: "顾辰雨夜潜入仓库窃取账簿，触发暗哨，被迫灭口后逃离"
  segments:
    - seg: 1
      focus: "雨夜潜行——翻墙、避哨、开锁"
      emotion: "紧绷、压抑"
      key_beat: "避开第三道红外线时险些触发"
      characters: ["顾辰"]
      location: "仓库外围+后院"
      time: "凌晨2:00-2:20"
    - seg: 2
      focus: "入室翻找——发现账簿、意识到账目被篡改"
      emotion: "震惊、愤怒"
      key_beat: "账簿第37页的签名是伪造的"
      characters: ["顾辰"]
      location: "仓库二楼办公室"
      time: "凌晨2:20-2:50"
    - seg: 3
      focus: "意外遭遇——暗哨发现、搏斗、灭口"
      emotion: "肾上腺素飙升→冷静后的空虚"
      key_beat: "尸体滑落时口袋里滚出B组的工作证"
      characters: ["顾辰", "暗哨(死者)"]
      location: "仓库二楼+楼梯间"
      time: "凌晨2:50-3:10"

# ── memo (7-field, filled at outline confirmation) ──
memo:
  why_this_scene: "顾辰必须拿到账簿，同时发现B组渗透的痕迹——为第8章AB对峙埋雷"
  reader_promise: "第37页的签名"
  reader_question: "死者口袋里为什么有B组的工作证？B组也在查同一件事？"
  emotion_curve: "压抑→紧张→高峰→空落→不安"
  character_state_change: "顾辰从'窃取者'变为'杀人者'，且开始怀疑B组的立场"
  thread_position: "卧底线从潜伏→暴露边缘，A线主动行动中首次死人"
  to_avoid: "不要把灭口写得太专业——顾辰是会计师不是杀手，应该笨拙、害怕、手抖"

status: "outline"  # outline → draft → archived

# ── compressed memory (populated at archive) ──
archive_summary: ""  # 200-char event summary, auto-generated on archive
```

#### threads.yaml (NEW — cross-chapter thread state)

```yaml
# threads.yaml — generated/updated on each archive
threads:
  "卧底线":                          # thread name (matches chapter.thread)
    pov: "顾辰"
    last_chapter: "vol-3-ch-15"     # most recent chapter on this thread
    current_state: "顾辰已获取账簿，但杀了一个人——且死者口袋里有B组的工作证"
    pending_questions:
      - "B组也在查同一家公司？"
      - "要不要联系B核实工作证？"
      - "暗哨死亡何时被发现？"
    active_hooks:
      - ref: "hook-003"
        description: "账簿第37页的伪造签名"
        status: "mentioned"          # mentioned → reinforced → resolved
      - ref: "hook-007"
        description: "死者口袋里的B组工作证"
        status: "mentioned"
    emotional_temperature: "high"    # low | medium | high | climax

  "潜伏线":
    pov: "林薇"
    last_chapter: "vol-3-ch-10"
    current_state: "林薇在慈善晚宴拿到宾客名单，发现目标人物'周总'不在名单上——他在暗处"
    pending_questions:
      - "周总为什么不在自己的宴会名单上？"
      - "名单上有个名字和顾辰的公司有关"
    active_hooks:
      - ref: "hook-005"
        description: "名单上'陈建东'——顾辰公司的财务总监"
        status: "mentioned"
    emotional_temperature: "medium"
```

#### hooks.yaml (unchanged from current, included for completeness)

```yaml
# settings/hooks.yaml
hooks:
  - id: "hook-003"
    description: "账簿第37页的伪造签名"
    introduced_in: "vol-3-ch-15"      # first mention
    type: "mystery"                    # mystery|conflict|character|relationship
    status: "mentioned"                # mentioned → reinforced → foreshadowed → resolved → abandoned
    resolve_plan: "vol-3-ch-18"        # intended resolution chapter (optional)
    mentions:
      - chapter: "vol-3-ch-15"
        segment: 2
        how: "顾辰翻账簿时注意到签名笔迹不对"
  - id: "hook-007"
    description: "死者口袋里的B组工作证"
    introduced_in: "vol-3-ch-15"
    type: "conflict"
    status: "mentioned"
    resolve_plan: "vol-3-ch-20"
    mentions:
      - chapter: "vol-3-ch-15"
        segment: 3
        how: "尸体口袋滚出工作证，顾辰认出B组徽章"
```

---

## 3. Workflow Engine

### 3.1 Phase State Machine

Each project has a `current_phase`. Transitions are gated.

```
                  ┌─────────┐
                  │  init   │  Phase 1: project created, skeleton exists
                  └────┬────┘
                       │ user fills settings → API validates completeness
                       ▼
                  ┌──────────┐
                  │ settings │  Phase 2: world, characters, style, hooks
                  └────┬─────┘
                       │ all required fields filled → API gate passes
                       ▼
                  ┌──────────┐
                  │ outline  │  Phase 3: volume/chapter planning
                  └────┬─────┘
                       │ chapter.segments populated, memo 7-field complete
                       ▼
                  ┌──────────┐
                  │ prompt   │  Phase 4: perspective conversion + prompt assembly
                  └────┬─────┘
                       │ prompt files exist for all segments
                       ▼
                  ┌──────────┐
                  │  write   │  Phase 5: streaming prose generation
                  └────┬─────┘
                       │ all segments written, quality check passed
                       ▼
                  ┌──────────┐
                  │ archive  │  Phase 6: finalize, update state, compress memory
                  └──────────┘
```

### 3.2 Gate Validation Rules

Each phase transition has a gate function. Gate fails → transition rejected, UI shows what's missing.

| Transition | Gate Checks |
|---|---|
| init → settings | story.yaml exists, author-intent.md populated |
| settings → outline | world-setting.yaml has ≥5 fields filled; ≥1 character defined; writing-style role set; hooks pool has ≥3 entries |
| outline → prompt | chapter.segments populated for target chapter; memo all 7 fields non-empty |
| prompt → write | prompt .md file exists for each segment of target chapter |
| write → archive | all segments generated and concatenated; quality check passed (anti-ai scan) |
| archive → outline | chapter.status = 'archived'; archive file exists; hooks and thread state updated |

### 3.3 API Routing by Phase

The frontend doesn't know phases. It shows the workspace; the API routes to the correct handler.

```python
# backend/workflow/router.py
async def handle_chapter_action(project_id, chapter_id, action):
    project = get_project(project_id)
    chapter = load_chapter(project.root_path, chapter_id)

    match project.current_phase, action:
        case "settings", "create_outline":
            if not gate_settings_complete(project):
                raise GateFailed(missing_fields=get_missing(project))
            project.current_phase = "outline"
            return create_volume_and_chapter(project, ...)

        case "outline", "confirm_chapter":
            if not gate_chapter_ready(chapter):
                raise GateFailed(...)
            return split_to_segments(chapter)  # → Phase 4

        case "prompt", "generate_prose":
            return StreamingResponse(generate_prose_stream(chapter))  # → Phase 5

        case "write", "archive":
            if not gate_quality_passed(chapter):
                raise GateFailed(...)
            return archive_chapter(project, chapter)  # → Phase 6
```

---

## 4. Prompt Assembly (Phase 4 Core)

This is the most sensitive engine in the system. Translates outline → AI-ready prose prompt.

### 4.1 Input / Output

```
Input:  chapter.yaml (outline + segments + memo + thread context)
        writing-style.yaml (role + core_principles + mistakes + techniques)
        anti-ai.yaml (blocklist + rules)
        threads.yaml (cross-thread context)
        hooks.yaml (active hooks)

Output: prompts/vol-N-ch-M-seg-X-prompt.md (5-section prose prompt)
```

### 4.2 Prompt Section Assembly

```python
def assemble_prompt(segment, context):
    return f"""
## 角色定位
你是{context.style.role}。{context.style.core_principles}

## 原则与禁忌
{context.style.possible_mistakes}

禁止使用以下词汇：{context.anti_ai.fatigue_words}
禁止以下句式：{context.anti_ai.forbidden_patterns}

## 故事背景
本段是{context.novel_title}第{vol}卷第{ch}章第{seg}段。
{inject_story_context(segment, context)}

{inject_character_snapshots(segment, context)}

{inject_active_hooks(segment, context)}

## 写作指引
{segment.focus}
情绪主调：{segment.emotion}
关键桥段：{segment.key_beat}
出场角色：{', '.join(segment.characters)}
地点：{segment.location}
时间：{segment.time}

注意：{context.chapter.memo.to_avoid}

## 写作要求
{context.style.depiction_techniques}
输出长度：约{segment.target_words}字。
不写总结、不写章节标题。
"""
```

### 4.3 Context Injection — the Memory Algorithm

```python
def inject_story_context(segment, context):
    """Build compressed context: sliding window + cross-thread awareness."""
    parts = []

    # --- same-thread history ---
    thread = context.threads[segment.chapter.thread]
    same_thread_chaps = get_thread_chapters(context.project, segment.chapter.thread)

    # Previous chapter on this thread → full outline
    if same_thread_chaps[-1]:
        parts.append(f"上一章（第{same_thread_chaps[-1].volume}卷第{same_thread_chaps[-1].chapter}章）：{same_thread_chaps[-1].outline.summary}")

    # 2nd-last → 200-char archive summary
    if len(same_thread_chaps) >= 2:
        parts.append(f"上两章概要：{same_thread_chaps[-2].archive_summary}")

    # 3rd and beyond → 100-char per chapter, max 3
    for ch in same_thread_chaps[-4:-2]:
        parts.append(f"前情：第{ch.volume}卷第{ch.chapter}章——{ch.archive_summary[:100]}")

    # --- concurrent threads ---
    if segment.chapter.concurrent_with:
        for ref in segment.chapter.concurrent_with:
            concurrent_ch = load_chapter(context.project.root_path, ref)
            t = context.threads[concurrent_ch.thread]
            parts.append(f"同时（{concurrent_ch.thread}）：{t.current_state}")

    # --- last crossover ---
    if segment.chapter.crossover_ref:
        x_ch = load_chapter(context.project.root_path, segment.chapter.crossover_ref)
        parts.append(f"上次交汇（第{x_ch.volume}卷第{x_ch.chapter}章）：{x_ch.outline.summary[:200]}")

    return "\n\n".join(parts)


def inject_character_snapshots(segment, context):
    """For each character appearing in this segment, include: role + current state + recent history."""
    chars = []
    for name in segment.characters:
        ch = load_character(context.project.root_path, name)
        chars.append(f"""
### {name}
身份：{ch.role}
当前状态：{ch.state_history[-1].state if ch.state_history else '初始'}
最近变化：{ch.state_history[-1].change if ch.state_history else '无'}
动机：{ch.current_motivation}
所在：{ch.current_location}
""")
    return "\n".join(chars)


def inject_active_hooks(segment, context):
    """Hooks that are pending or reinforced, relevant to this segment's thread."""
    hooks = [h for h in context.hooks
             if h.status in ('mentioned', 'reinforced')
             and h.introduced_in != segment.chapter.ref]
    if not hooks:
        return ""
    return "## 当前悬而未决的伏笔\n" + "\n".join(
        f"- [{h.id}] {h.description}（状态：{h.status}）" for h in hooks[:8]
    )
```

### 4.4 Perspective Conversion (Step 1 of Phase 4)

Before prompt assembly, chapter outline goes through perspective conversion:
- **Input**: God-view outline ("顾辰潜入仓库，发现账簿被篡改")
- **Output**: Immersive guidance ("你现在是顾辰。雨水顺着领口往下淌，手指冻得发僵。面前的账簿摊在第37页...")

This is itself an AI call (lightweight, ~500 tokens), done once per chapter before segment splitting. The result is stored in chapter.yaml under `outline.perspective_guidance` and injected as the "写作指引" section's opener.

---

## 5. Phase 5 — Streaming Write

### 5.1 Architecture

```
Frontend                                Backend
────────                                ───────

[Writing Studio]
 ┌──────────────────────┐
 │ Seg 1 ████████░░░░   │  ◄── SSE /api/write/stream ──►  asyncio generator
 │ 雨水顺着领口往下淌…   │        chunk by chunk             │
 ├──────────────────────┤                                   ├── Anthropic API
 │ Seg 2 ████░░░░░░░░   │  ◄── SSE (parallel) ──────────►  │   stream=True
 │ 翻到第37页时他愣住…   │                                   │
 ├──────────────────────┤                                   ├── anti-ai scan
 │ Seg 3 ░░░░░░░░░░░░   │  ◄── SSE (parallel) ──────────►  │   (real-time)
 │ (waiting...)         │                                   │
 └──────────────────────┘
    [Pause seg 2] [Stop all]
```

One SSE stream per segment. Frontend opens multiple EventSource connections. User can pause/stop individual segments mid-stream.

### 5.2 Backend Streaming Handler

```python
# backend/write/stream.py
async def generate_segment_stream(project, chapter, segment, api_key):
    prompt = read_prompt_file(project.root_path, chapter, segment)

    # Build messages
    system_msg = build_system_from_style(project)
    user_msg = prompt

    async for chunk in anthropic_stream(messages=[system_msg, user_msg], ...):
        # Real-time anti-ai scan on each sentence boundary
        violations = scan_chunk(chunk, project.settings.anti_ai)
        yield {
            "type": "chunk" if not violations else "violation",
            "text": chunk,
            "violations": violations,  # [] or list of rule violations
        }

    yield {"type": "done", "segment": segment, "total_tokens": ...}
```

### 5.3 Frontend Writing Studio

Three-pane layout:
- **Left rail**: chapter outline + segment list (collapsible)
- **Center**: multi-column streaming panes (one per segment, up to 4 side-by-side)
- **Right rail**: anti-ai violation panel (red badges on affected segments)

Controls per segment: pause / resume / regenerate / accept.

### 5.4 Quality Check (Phase 5→6 gate)

Six checks, run incrementally:
1. **anti-ai fatigue words**: scan against blocklist, flag in real-time
2. **sentence pattern violation**: detect forbidden patterns ("不是…而是…" overuse)
3. **dialogue ratio**: compare to writing-style target range
4. **description ratio**: compare to writing-style target range
5. **hook mention check**: verify hooks assigned to this chapter are actually mentioned
6. **continuity check**: compare against previous chapter's ending state (AI call, ~1K tokens)

Check results stored in `chapter.yaml` under `quality_check:`. All must pass before archive.

---

## 6. Backup & Export

- **Per-user backup**: tar the entire `/data/{user_id}/` directory. Cron job, daily.
- **Per-project export**: user clicks "Export" → zip download of their project directory (YAML + MD).
- **Import**: user uploads zip → `import.py` logic splits into archive files → Agent reverse-extracts settings.

---

## 7. Multi-User Isolation

| Layer | How |
|-------|-----|
| Filesystem | `/data/{user_id}/` — Linux file permissions, each user_id is a directory |
| Database | All queries scoped by `user_id` from JWT |
| API | JWT middleware extracts user_id; all project lookups cross-check ownership |
| Token accounting | `token_log.user_id` — never deduct from another user |

No project sharing. No collaboration features in v1.

---

## 8. API Surface (v1)

```
# Auth
POST   /api/auth/register        { email, password, display_name }
POST   /api/auth/login           { email, password } → { access_token, refresh_token }
POST   /api/auth/refresh         { refresh_token } → { access_token }
GET    /api/auth/me              → user info + token balance

# Projects
GET    /api/projects             → list user's projects
POST   /api/projects             { name } → create project (runs init.py logic)
GET    /api/projects/{id}        → project detail + current_phase
DELETE /api/projects/{id}        → soft-delete (or hard delete with confirmation)

# Settings (Phase 2)
GET    /api/projects/{id}/settings/{type}
                                   type: world|style|anti-ai|hooks|character/{name}
PUT    /api/projects/{id}/settings/{type}  { body: YAML as JSON }

# Volumes & Chapters (Phase 3)
GET    /api/projects/{id}/volumes          → list volumes with chapter tree
POST   /api/projects/{id}/volumes          { title } → create volume
GET    /api/projects/{id}/chapters/{ch}    → full chapter YAML as JSON
PUT    /api/projects/{id}/chapters/{ch}    { outline, memo, segments... }
POST   /api/projects/{id}/chapters/{ch}/confirm  → gate check → Phase 4

# Prompts (Phase 4)
POST   /api/projects/{id}/chapters/{ch}/perspective  → run perspective conversion AI call
GET    /api/projects/{id}/chapters/{ch}/prompts       → list assembled prompts
POST   /api/projects/{id}/chapters/{ch}/prompts/generate → assemble all segment prompts

# Write (Phase 5)
GET    /api/projects/{id}/chapters/{ch}/write/stream/{seg}  → SSE stream
POST   /api/projects/{id}/chapters/{ch}/write/stop/{seg}    → cancel stream
POST   /api/projects/{id}/chapters/{ch}/write/quality-check → run 6 checks

# Archive (Phase 6)
POST   /api/projects/{id}/chapters/{ch}/archive  → finalize + compress memory

# Billing
GET    /api/billing/usage         → token usage history
GET    /api/billing/plans         → available plans
POST   /api/billing/purchase      { plan, payment_method }
```

---

## 9. Frontend Route Map

```
/login                          → LoginPage
/register                       → RegisterPage
/dashboard                      → ProjectList (cards with progress bars)
/project/{slug}                 → redirect to current phase page

/project/{slug}/settings        → SettingsEditor
  /settings/world               → WorldSettingForm
  /settings/style               → StyleConfigurator (genre picker, skill layers)
  /settings/anti-ai             → AntiAIRuleEditor (blocklist manager)
  /settings/hooks               → HooksBoard (kanban: pending → mentioned → resolved)
  /settings/characters          → CharacterList
  /settings/characters/{name}   → CharacterEditor

/project/{slug}/outline         → OutlineBoard
  /outline/volumes              → VolumeList (drag-to-reorder chapters)
  /outline/chapters/{ch}        → ChapterEditor (segments + memo form)

/project/{slug}/prompts         → PromptViewer (side-by-side: outline | prompt)
/project/{slug}/write           → WritingStudio (multi-pane streaming)
/project/{slug}/archives        → ArchiveReader (pagination, search)

/project/{slug}/threads         → ThreadTimeline (NEW: visual timeline of threads)
```

---

## 10. Deployment (v1)

Single VPS (or single Docker host):

```
docker-compose:
  - nginx:     reverse proxy + static files
  - backend:   FastAPI (uvicorn, 4 workers)
  - frontend:  Next.js (npm run start, 2 workers)
  - postgres:  PostgreSQL 16

Volumes:
  - postgres_data:/var/lib/postgresql/data
  - novel_data:/data/projects     ← all user novel files
```

No Kubernetes. No microservices. One binary + one DB + filesystem.

---

## 11. Cost & Token Accounting

### 11.1 Token Tracking

Every AI call logs to `token_log`. Before each call:
```python
if user.token_balance < estimated_cost * safety_margin:
    raise InsufficientTokens()

# After call:
user.token_balance -= actual_cost
user.total_tokens += actual_tokens
token_log.insert(operation, tokens_in, tokens_out, cost_cents)
```

### 11.2 Pricing Model (reference)

| Plan | Included Tokens | Price |
|------|----------------|-------|
| Free | 50K | $0 |
| Pro | 500K | $15/month |
| Unlimited | 2M | $49/month |

Overage: Pro users auto-top-up at rate. Pricing adjustable via admin panel.

---

## 12. What's NOT in v1

- Team collaboration / project sharing
- Mobile app (API-first makes this v2 addition straightforward)
- Offline mode
- Plugin system
- Custom AI model fine-tuning
- Import from other novel platforms
- Public novel publishing / sharing
- Comments / beta reader features
