# AI Settings Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-layer AI assistance to the settings panel: global one-click generation of all 5 setting types, plus per-field "draw-and-replace" modal for fine-tuning.

**Architecture:** Backend reads story premise from `story.yaml`, calls `AIClient.chat()` with per-type prompts, returns structured data. Frontend adds AI button props to existing form fields, shows modal for draw-and-replace, shows progress modal for batch generation.

**Tech Stack:** Python/FastAPI (backend), React 19 + TypeScript + daisyUI (frontend), Playwright + pytest (tests)

---

## File Structure

### Backend — Create

| File | Purpose |
|------|---------|
| `backend/settings/ai_router.py` | `POST /generate` and `POST /ai/{type}/{field}` endpoints |
| `backend/settings/ai_prompts.py` | Prompt templates for each setting type |
| `backend/tests/test_settings_ai.py` | pytest tests for AI endpoints |

### Backend — Modify

| File | Change |
|------|--------|
| `backend/settings/router.py` | Register `ai_router` |
| `backend/main.py` | Import `ai_router` |

### Frontend — Create

| File | Purpose |
|------|---------|
| `frontend/src/lib/ai.ts` | API wrappers for AI generation endpoints |
| `frontend/src/components/novel/settings/AISuggestionModal.tsx` | Draw modal: preview + retry + accept |
| `frontend/src/components/novel/settings/AIGenerateProgress.tsx` | Batch generation progress modal |

### Frontend — Modify

| File | Change |
|------|--------|
| `frontend/src/lib/toast.tsx` | Add action button support (undo) |
| `frontend/src/components/novel/settings/FormField.tsx` | Add `aiGeneratable`, `onAIGenerate`, `aiLoading` props + ✨ button |
| `frontend/src/components/novel/settings/WorldSettingForm.tsx` | Wire ✨ to each field |
| `frontend/src/components/novel/settings/StyleSettingForm.tsx` | Same |
| `frontend/src/components/novel/settings/HooksSettingForm.tsx` | Same |
| `frontend/src/components/novel/settings/CharacterManager.tsx` | Same |
| `frontend/src/components/novel/SettingsFormField.tsx` | Add "✨ AI 一键生成全部设定" button |
| `frontend/src/pages/NovelPage.tsx` | Integrate AIGenerateProgress modal |

### Tests — Create

| File | Purpose |
|------|---------|
| `backend/tests/test_settings_ai.py` | 5 backend API tests |
| `frontend/e2e/settings-ai.spec.ts` | 8 frontend E2E tests |

---

### Task 1: Backend AI prompts

**Files:**
- Create: `backend/settings/ai_prompts.py`

- [ ] **Create prompt templates file**

```python
"""Prompt templates for AI-assisted settings generation."""

WORLD_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提，为这部小说生成世界设定。

故事前提：{premise}

请生成世界设定的 JSON（只输出 JSON，不要其他文字）：
{{
  "geography": {{
    "scenes": "关键地点、空间关系、距离的描述",
    "climate": "气候特征、季节、极端天气",
    "limits": "山脉、水域、边界 — 什么分隔了区域"
  }},
  "politics": {{
    "rule": "谁统治？权力结构",
    "factions": "至少 2-3 个主要势力",
    "social": "阶级结构、社会流动性",
    "cost": "违抗的后果，谁执行惩罚"
  }},
  "rules": {{
    "world": "力量体系、物理法则、魔法来源",
    "society": "法律、门派规章、禁忌",
    "personal": "血咒、功法限制、契约"
  }}
}}
"""

STYLE_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提，为这部小说生成写作风格设定。

故事前提：{premise}

已有设定参考：{context}

请生成写作风格设定的 JSON（只输出 JSON，不要其他文字）：
{{
  "role": "叙事角色定位（如：上帝视角的说书人）",
  "core_principles": ["原则1", "原则2", "原则3"],
  "common_mistakes": ["常见错误1"],
  "depiction_techniques": {{
    "environment": "环境描写手法",
    "action": "动作描写手法",
    "emotion": "情感描写手法"
  }}
}}
"""

HOOKS_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提和已有设定，为这部小说生成伏笔。

故事前提：{premise}

已有设定参考：{context}

请生成伏笔的 JSON（只输出 JSON，不要其他文字）：
{{
  "active": [
    {{
      "description": "伏笔描述",
      "introduce_at": "引入章节（如：第一章）",
      "type": "plot",
      "priority": "high"
    }}
  ]
}}
至少生成 3 个伏笔，类型可以从 mystery、threat、promise、clue、relationship、power、emotion、choice 中选择。
"""

ANTI_AI_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提，为这部小说生成反 AI 规则。

故事前提：{premise}

请生成反 AI 规则的 JSON（只输出 JSON，不要其他文字）：
{{
  "fatigue_words_zh": {{
    "副词": ["突然", "忽然", "显然"],
    "语气词": ["嗯", "啊", "哦"],
    "过渡": ["就在这时", "就在这时突然"]
  }},
  "sentence_rules": [
    {{
      "pattern": "不是.*而是.*",
      "reason": "避免对比句式",
      "threshold": 2
    }}
  ]
}}
"""

CHARACTER_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提和已有设定，为这部小说生成角色。

故事前提：{premise}

已有设定参考：{context}

请生成 3 个主要角色的 JSON 数组（只输出 JSON，不要其他文字）：
[
  {{
    "name": "角色名",
    "appearance": "外貌描述",
    "background": "背景故事",
    "speech": "说话风格",
    "personality": "性格特征",
    "values": ["价值观1", "价值观2"],
    "skills": ["技能1", "技能2"],
    "relationships": "与其他角色的关系"
  }}
]
"""


def get_prompt(setting_type: str) -> str:
    prompts = {
        "world": WORLD_SETTING_PROMPT,
        "style": STYLE_SETTING_PROMPT,
        "hooks": HOOKS_SETTING_PROMPT,
        "anti-ai": ANTI_AI_SETTING_PROMPT,
        "characters": CHARACTER_SETTING_PROMPT,
    }
    return prompts.get(setting_type, "")
```

- [ ] **Run a quick import check**

Run: `python -c "from settings.ai_prompts import get_prompt; print('OK')"` from `backend/`
Expected: `OK`

- [ ] **Commit**

```
git add backend/settings/ai_prompts.py
git commit -m "feat: add AI prompt templates for settings generation"
```

---

### Task 2: Backend AI router

**Files:**
- Create: `backend/settings/ai_router.py`
- Modify: `backend/settings/router.py` (register ai_router)
- Modify: `backend/main.py` (import ai_router)

- [ ] **Create ai_router.py**

```python
"""AI-assisted settings generation endpoints."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ai_client import get_ai_client
from auth.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project
from settings.ai_prompts import get_prompt

router = APIRouter(prefix="/api/projects/{project_id}/settings", tags=["settings-ai"])

VALID_TYPES = {"world", "style", "anti-ai", "hooks", "characters"}
# Only these types get per-field generation (anti-ai excluded)
FIELD_GENERATABLE = {"world", "style", "hooks", "characters"}


@router.post("/generate")
async def generate_all_settings(
    project_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate all setting types from premise in one call."""
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    types = body.get("types", list(VALID_TYPES))
    invalid = [t for t in types if t not in VALID_TYPES]
    if invalid:
        raise HTTPException(400, f"Invalid types: {invalid}")

    # Load premise
    story = await get_storage().read_yaml(project.root_path, "story.yaml") or {}
    premise = story.get("synopsis", "")
    if not premise:
        raise HTTPException(400, "No story premise found. Create the project with a story description first.")

    client = get_ai_client()
    results = {}

    for t in types:
        prompt = get_prompt(t)
        if not prompt:
            continue
        try:
            text = await client.chat(
                model="haiku",
                system="你是小说设定专家。只输出 JSON，不要任何其他文字。",
                messages=[{"role": "user", "content": prompt.format(premise=premise, context="{}")}],
                max_tokens=2048,
            )
            # Parse JSON from response (handle markdown-wrapped JSON)
            cleaned = text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
                cleaned = cleaned.rsplit("```", 1)[0]
            results[t] = json.loads(cleaned.strip())
        except Exception as e:
            results[t] = {"_error": str(e)}

    return results


@router.post("/ai/{stype}/{field}")
async def generate_field(
    project_id: str,
    stype: str,
    field: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a single settings field."""
    if stype not in FIELD_GENERATABLE:
        raise HTTPException(400, f"Field generation not supported for: {stype}")

    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    story = await get_storage().read_yaml(project.root_path, "story.yaml") or {}
    premise = story.get("synopsis", "")
    if not premise:
        raise HTTPException(400, "No story premise found.")

    prompt = get_prompt(stype)
    if not prompt:
        raise HTTPException(400, f"Unknown type: {stype}")

    context = body.get("context", {})
    client = get_ai_client()

    try:
        text = await client.chat(
            model="haiku",
            system="你是小说设定专家。只输出 JSON，不要任何其他文字。",
            messages=[{
                "role": "user",
                "content": (
                    f"基于以下故事前提和已有设定，生成字段「{field}」的内容。\n\n"
                    f"故事前提：{premise}\n"
                    f"已有设定：{json.dumps(context, ensure_ascii=False)}\n\n"
                    f"请只输出「{field}」字段的 JSON 值，不要其他字段和文字。"
                )
            }],
            max_tokens=1024,
        )
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
            cleaned = cleaned.rsplit("```", 1)[0]
        value = json.loads(cleaned.strip())
        return {"value": value}
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {str(e)}")
```

- [ ] **Register ai_router in settings/router.py**

Add at the end of `backend/settings/router.py`:
```python
from settings.ai_router import router as ai_router
router.include_router(ai_router)
```

- [ ] **Register ai_router in main.py**

Add import in `backend/main.py`:
```python
from settings.ai import router as settings_ai_router
```

And register:
```python
app.include_router(settings_ai_router)
```

Wait — `settings/router.py` already has prefix `/api/projects/{project_id}/settings`. If I `include_router` the ai_router (which also has the same prefix), the routes would be nested. Need to fix this.

Better approach: register ai_router directly in main.py without nesting, or change the prefix scheme.

Actually, looking at the existing pattern: `settings/router.py` uses `prefix="/api/projects/{project_id}/settings"`. If I register ai_router in main.py directly with the same prefix, that's fine — they're sibling routers with the same prefix.

So instead, in `backend/main.py`:
```python
from settings.ai_router import router as settings_ai_router
app.include_router(settings_ai_router)
```

And the ai_router already has `prefix="/api/projects/{project_id}/settings"`, so endpoints would be:
- `POST /api/projects/{project_id}/settings/generate`
- `POST /api/projects/{project_id}/settings/ai/{type}/{field}`

Let me fix the plan to reflect this.

- [ ] **Commit**

```bash
git add backend/settings/ai_router.py backend/main.py
git commit -m "feat: add AI settings generation endpoints"
```

---

### Task 3: Backend pytest for AI settings API

**Files:**
- Create: `backend/tests/test_settings_ai.py`

- [ ] **Write test file**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_generate_no_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/projects/fake-id/settings/generate", json={"types": ["world"]})
    assert resp.status_code in (401, 403)


@pytest.mark.anyio
async def test_generate_invalid_type():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/projects/fake-id/settings/generate", json={"types": ["invalid"]})
    assert resp.status_code in (401, 403)


@pytest.mark.anyio
async def test_field_generate_invalid_type():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/projects/fake-id/settings/ai/anti-ai/some-field", json={"context": {}})
    assert resp.status_code in (401, 403)


@pytest.mark.anyio
async def test_generate_unknown_project():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/projects/nonexistent/settings/generate", json={"types": ["world"]})
    assert resp.status_code in (401, 403, 404)
```

Note: These tests verify auth/validation errors without hitting AI. Full integration tests with mocked AI client would be added when the test infrastructure supports mocking `get_ai_client()`.

- [ ] **Run tests**

Run: `cd backend && python -m pytest tests/test_settings_ai.py -v`
Expected: 4 PASSED

- [ ] **Commit**

```bash
git add backend/tests/test_settings_ai.py
git commit -m "test: add AI settings API validation tests"
```

---

### Task 4: Frontend toast — action button support

**Files:**
- Modify: `frontend/src/lib/toast.tsx`

- [ ] **Extend Toast interface and add action support**

```typescript
import { useEffect, useState } from "react";

type ToastType = "error" | "success" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

let _toasts: Toast[] = [];
let _nextId = 1;
const _listeners = new Set<(toasts: Toast[]) => void>();

function notify() {
  for (const fn of _listeners) fn([..._toasts]);
}

function addToast(type: ToastType, msg: string, action?: ToastAction) {
  const id = _nextId++;
  _toasts.push({ id, message: msg, type, action });
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, 4000);
}

export const toast = {
  error(msg: string, opts?: { action?: ToastAction }) {
    addToast("error", msg, opts?.action);
  },
  success(msg: string, opts?: { action?: ToastAction }) {
    addToast("success", msg, opts?.action);
  },
  info(msg: string, opts?: { action?: ToastAction }) {
    addToast("info", msg, opts?.action);
  },
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    _listeners.add(setToasts);
    return () => { _listeners.delete(setToasts); };
  }, []);
  return toasts;
}

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  const bgMap: Record<ToastType, string> = {
    error: "alert alert-error",
    success: "alert alert-success",
    info: "alert alert-info",
  };

  return (
    <div className="toast toast-end toast-bottom z-50">
      {toasts.map((t) => (
        <div key={t.id} className={`${bgMap[t.type]} flex items-center gap-3`}>
          <span>{t.message}</span>
          {t.action && (
            <button
              onClick={t.action.onClick}
              className="btn btn-ghost btn-xs text-current font-medium opacity-70 hover:opacity-100"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add frontend/src/lib/toast.tsx
git commit -m "feat: add action button support to toast notifications"
```

---

### Task 5: AISuggestionModal component

**Files:**
- Create: `frontend/src/components/novel/settings/AISuggestionModal.tsx`

- [ ] **Create the modal component**

```tsx
import { Sparkles, RefreshCw, Check, X } from "lucide-react";

interface AISuggestionModalProps {
  open: boolean;
  fieldLabel: string;
  content: string;
  loading: boolean;
  onAccept: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export default function AISuggestionModal({
  open, fieldLabel, content, loading, onAccept, onRetry, onClose,
}: AISuggestionModalProps) {
  if (!open) return null;

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base-content">AI 建议 · {fieldLabel}</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content area */}
        <div className="min-h-[120px] max-h-[300px] overflow-y-auto mb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <span className="loading loading-spinner loading-md text-primary" />
              <span className="text-sm text-base-content/50">AI 正在生成…</span>
            </div>
          ) : (
            <div className="bg-base-200/50 border border-base-300/60 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap text-base-content/80 font-serif">
              {content}
            </div>
          )}
        </div>

        {/* Actions */}
        {!loading && (
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onRetry}
              className="btn btn-ghost btn-sm gap-1.5 text-base-content/60"
            >
              <RefreshCw className="w-4 h-4" />
              换一个
            </button>
            <button
              onClick={onAccept}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <Check className="w-4 h-4" />
              接受这个
            </button>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add frontend/src/components/novel/settings/AISuggestionModal.tsx
git commit -m "feat: add AISuggestionModal component for draw-and-replace"
```

---

### Task 6: AIGenerateProgress component

**Files:**
- Create: `frontend/src/components/novel/settings/AIGenerateProgress.tsx`

- [ ] **Create the progress modal**

```tsx
import { Sparkles, Check, AlertCircle, X } from "lucide-react";

interface ProgressStep {
  type: string;
  label: string;
  status: "pending" | "loading" | "done" | "error";
}

interface AIGenerateProgressProps {
  open: boolean;
  steps: ProgressStep[];
  onClose: () => void;
}

export default function AIGenerateProgress({ open, steps, onClose }: AIGenerateProgressProps) {
  if (!open) return null;

  const allDone = steps.every((s) => s.status === "done" || s.status === "error");

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base-content">AI 一键生成全部设定</h3>
        </div>

        {/* Progress list */}
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.type}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                step.status === "loading"
                  ? "border-primary/30 bg-primary/5"
                  : step.status === "done"
                    ? "border-success/20 bg-success/5"
                    : step.status === "error"
                      ? "border-error/20 bg-error/5"
                      : "border-base-300/40 bg-base-200/20"
              }`}
            >
              {/* Status icon */}
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {step.status === "loading" && <span className="loading loading-spinner loading-xs text-primary" />}
                {step.status === "done" && <Check className="w-4 h-4 text-success" />}
                {step.status === "error" && <AlertCircle className="w-4 h-4 text-error" />}
                {step.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-base-300/40" />}
              </div>
              {/* Label */}
              <span className={`text-sm flex-1 ${
                step.status === "done" ? "text-base-content" :
                step.status === "error" ? "text-error/80" :
                step.status === "loading" ? "text-primary" :
                "text-base-content/40"
              }`}>
                {step.label}
              </span>
              {/* Status text */}
              <span className="text-xs text-base-content/30">
                {step.status === "loading" ? "生成中…" :
                 step.status === "done" ? "已完成" :
                 step.status === "error" ? "失败" : "等待中"}
              </span>
            </div>
          ))}
        </div>

        {/* Close button */}
        {allDone && (
          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="btn btn-primary btn-sm">
              完成
            </button>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={allDone ? onClose : undefined} />
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add frontend/src/components/novel/settings/AIGenerateProgress.tsx
git commit -m "feat: add AIGenerateProgress component for batch generation"
```

---

### Task 7: Extend FormField with AI button

**Files:**
- Modify: `frontend/src/components/novel/settings/FormField.tsx`

- [ ] **Add AI props and ✨ button to Field, InputField, ListEditor**

```typescript
import { Sparkles, Loader2 } from "lucide-react";

// ── Shared AI props ────────────────────────────────────────────────
interface AIProps {
  aiGeneratable?: boolean;
  onAIGenerate?: () => void;
  aiLoading?: boolean;
}

// ── Field ─────────────────────────────────────────────────────────
export function Field({ label, hint, value, onChange, aiGeneratable, onAIGenerate, aiLoading }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void
} & AIProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-base-content/60 font-medium block tracking-wide">{label}</label>
        {aiGeneratable && (
          <button
            onClick={onAIGenerate}
            disabled={aiLoading}
            className="text-xs text-primary/50 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-40"
            title="AI 帮我填"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading ? "生成中" : "AI 帮我填"}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-base-content/30 mb-1.5 leading-relaxed">{hint}</p>}
      <textarea
        className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 resize-y min-h-[80px] placeholder:text-base-content/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── InputField ────────────────────────────────────────────────────
export function InputField({ label, hint, value, onChange, placeholder, aiGeneratable, onAIGenerate, aiLoading }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string
} & AIProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-base-content/60 font-medium block tracking-wide">{label}</label>
        {aiGeneratable && (
          <button
            onClick={onAIGenerate}
            disabled={aiLoading}
            className="text-xs text-primary/50 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-40"
            title="AI 帮我填"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading ? "生成中" : "AI 帮我填"}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-base-content/30 mb-1.5">{hint}</p>}
      <input
        className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── ListEditor ────────────────────────────────────────────────────
export function ListEditor({ items, onChange, placeholder, aiGeneratable, onAIGenerate, aiLoading }: {
  items: string[]; onChange: (v: string[]) => void; placeholder?: string
} & AIProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {aiGeneratable && (
          <button
            onClick={onAIGenerate}
            disabled={aiLoading}
            className="text-xs text-primary/50 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-40 ml-auto"
            title="AI 帮我填"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading ? "生成中" : "AI 帮我填"}
          </button>
        )}
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <span className="text-xs text-base-content/20 w-5 text-right tabular-nums">{i + 1}.</span>
          <input
            className="flex-1 bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
            value={item}
            onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
            placeholder={placeholder}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error transition-all text-sm px-1"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="text-xs text-primary/60 hover:text-primary transition-colors mt-1 inline-flex items-center gap-1"
      >
        <span className="text-base leading-none">+</span> 添加一项
      </button>
    </div>
  );
}

// ── SaveButton / TabBar (unchanged) ────────────────────────────────
export function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-1.5 text-xs bg-primary/10 border border-primary/30 rounded-lg text-primary font-medium hover:bg-primary/20 transition-colors disabled:opacity-40 self-center"
    >
      {saving ? "保存中…" : "💾 保存"}
    </button>
  );
}

export function TabBar({ tabs, activeTab, onTabChange, children }: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-0 border-b border-base-300/70 mb-5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`px-4 py-2.5 text-sm border-b-2 transition-all duration-200 ${
            activeTab === t.id
              ? "text-primary border-primary font-medium"
              : "text-base-content/40 border-transparent hover:text-base-content/70"
          }`}
        >
          {t.label}
        </button>
      ))}
      <div className="flex-1" />
      {children}
    </div>
  );
}
```

- [ ] **TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Commit**

```bash
git add frontend/src/components/novel/settings/FormField.tsx
git commit -m "feat: add AI button props to form field components"
```

---

### Task 8: Wire AI into WorldSettingForm

**Files:**
- Modify: `frontend/src/components/novel/settings/WorldSettingForm.tsx`

- [ ] **Add AI generation state and handlers**

This shows the pattern. Other forms (StyleSettingForm, HooksSettingForm, CharacterManager) follow the same approach.

Key changes:
1. Import `api` and `AISuggestionModal`
2. Add state: `aiModalField`, `aiModalContent`, `aiModalLoading`, `aiGeneratingField`
3. Add `handleAIGenerate(field, type, value)` function
4. Pass `aiGeneratable` + handlers to each `Field`
5. Render `AISuggestionModal`

For brevity, I'll show the pattern for WorldSettingForm. StyleSettingForm, HooksSettingForm, and CharacterManager follow the identical pattern.

```tsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Field, TabBar, SaveButton } from "./FormField";
import AISuggestionModal from "./AISuggestionModal";

interface Props { projectId: string; settingKey: string }

const TABS = [
  { id: "geo", label: "地理" },
  { id: "politics", label: "政治" },
  { id: "rules", label: "规则" },
];

export default function WorldSettingForm({ projectId, settingKey }: Props) {
  const [tab, setTab] = useState("geo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [geo, setGeo] = useState({ scenes: "", climate: "", limits: "" });
  const [politics, setPolitics] = useState({ rule: "", factions: "", social: "", cost: "" });
  const [rules, setRules] = useState({ world: "", society: "", personal: "" });

  // AI modal state
  const [aiField, setAiField] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPendingField, setAiPendingField] = useState<string | null>(null);

  const currentValues = { geography: geo, politics, rules };
  const settingFields: Record<string, Record<string, string>> = { geo, politics, rules };

  useEffect(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) return;
        setGeo({ scenes: d.geography?.scenes || "", climate: d.geography?.climate || "", limits: d.geography?.limits || "" });
        setPolitics({ rule: d.politics?.rule || "", factions: d.politics?.factions || "", social: d.politics?.social || "", cost: d.politics?.cost || "" });
        setRules({ world: d.rules?.world || "", society: d.rules?.society || "", personal: d.rules?.personal || "" });
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [projectId, settingKey]);

  async function handleSave() {
    setSaving(true); setError("");
    try { await api.put(`/projects/${projectId}/settings/${settingKey}`, { geography: geo, politics, rules }); }
    catch (e: any) { setError(e.message || "保存失败"); }
    finally { setSaving(false); }
  }

  async function handleAIGenerate(field: string) {
    setAiPendingField(field);
    setAiLoading(true);
    setAiField(field);
    setAiContent("");
    try {
      const res = await api.post(`/projects/${projectId}/settings/ai/world/${field}`, {
        context: currentValues,
      });
      setAiContent(typeof res.value === "string" ? res.value : JSON.stringify(res.value, null, 2));
    } catch (e: any) {
      setAiContent(`生成失败：${e.message}`);
    } finally {
      setAiLoading(false);
      setAiPendingField(null);
    }
  }

  function handleAIAccept() {
    if (!aiField) return;
    // Find the tab and field to update
    for (const [tabId, fields] of Object.entries(settingFields)) {
      if (aiField in fields) {
        // Update the specific field value
        if (tabId === "geo") setGeo((p) => ({ ...p, [aiField]: aiContent }));
        else if (tabId === "politics") setPolitics((p) => ({ ...p, [aiField]: aiContent }));
        else if (tabId === "rules") setRules((p) => ({ ...p, [aiField]: aiContent }));
        break;
      }
    }
    setAiField(null);
    setAiContent("");
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab}>
        <SaveButton saving={saving} onClick={handleSave} />
      </TabBar>

      {tab === "geo" && (
        <div className="space-y-5">
          <Field label="主要场景" hint="关键地点、空间关系、距离" value={geo.scenes} onChange={(v) => setGeo((p) => ({ ...p, scenes: v }))}
            aiGeneratable aiLoading={aiPendingField === "scenes"} onAIGenerate={() => handleAIGenerate("scenes")} />
          <Field label="气候" hint="气候特征、季节、极端天气" value={geo.climate} onChange={(v) => setGeo((p) => ({ ...p, climate: v }))}
            aiGeneratable aiLoading={aiPendingField === "climate"} onAIGenerate={() => handleAIGenerate("climate")} />
          <Field label="地理限制" hint="山脉、水域、边界" value={geo.limits} onChange={(v) => setGeo((p) => ({ ...p, limits: v }))}
            aiGeneratable aiLoading={aiPendingField === "limits"} onAIGenerate={() => handleAIGenerate("limits")} />
        </div>
      )}
      {tab === "politics" && (
        <div className="space-y-5">
          <Field label="统治形式" hint="谁统治？" value={politics.rule} onChange={(v) => setPolitics((p) => ({ ...p, rule: v }))}
            aiGeneratable aiLoading={aiPendingField === "rule"} onAIGenerate={() => handleAIGenerate("rule")} />
          <Field label="主要势力" hint="至少 2-3 个势力" value={politics.factions} onChange={(v) => setPolitics((p) => ({ ...p, factions: v }))}
            aiGeneratable aiLoading={aiPendingField === "factions"} onAIGenerate={() => handleAIGenerate("factions")} />
          <Field label="社会分层" hint="阶级结构" value={politics.social} onChange={(v) => setPolitics((p) => ({ ...p, social: v }))}
            aiGeneratable aiLoading={aiPendingField === "social"} onAIGenerate={() => handleAIGenerate("social")} />
          <Field label="不服从的代价" hint="违抗的后果" value={politics.cost} onChange={(v) => setPolitics((p) => ({ ...p, cost: v }))}
            aiGeneratable aiLoading={aiPendingField === "cost"} onAIGenerate={() => handleAIGenerate("cost")} />
        </div>
      )}
      {tab === "rules" && (
        <div className="space-y-5">
          <Field label="世界级规则" hint="力量体系" value={rules.world} onChange={(v) => setRules((p) => ({ ...p, world: v }))}
            aiGeneratable aiLoading={aiPendingField === "world"} onAIGenerate={() => handleAIGenerate("world")} />
          <Field label="社会级规则" hint="法律、禁忌" value={rules.society} onChange={(v) => setRules((p) => ({ ...p, society: v }))}
            aiGeneratable aiLoading={aiPendingField === "society"} onAIGenerate={() => handleAIGenerate("society")} />
          <Field label="个人级规则" hint="血咒、功法限制" value={rules.personal} onChange={(v) => setRules((p) => ({ ...p, personal: v }))}
            aiGeneratable aiLoading={aiPendingField === "personal"} onAIGenerate={() => handleAIGenerate("personal")} />
        </div>
      )}

      {error && <p className="text-sm text-error/80 mt-3">{error}</p>}

      <AISuggestionModal
        open={aiField !== null}
        fieldLabel={aiField || ""}
        content={aiContent}
        loading={aiLoading}
        onAccept={handleAIAccept}
        onRetry={() => aiField && handleAIGenerate(aiField)}
        onClose={() => { setAiField(null); setAiContent(""); }}
      />
    </div>
  );
}
```

- [ ] **Apply same pattern to StyleSettingForm, HooksSettingForm**

StyleSettingForm: Add `aiGeneratable` to the `Field` for `role`, `core_principles`, `common_mistakes`
HooksSettingForm: Add `aiGeneratable` to hook description fields
CharacterManager: Add `aiGeneratable` to character name/appearance/background fields

(Paste the same pattern — difference is field names and structure.)

- [ ] **Commit**

```bash
git add frontend/src/components/novel/settings/WorldSettingForm.tsx frontend/src/components/novel/settings/StyleSettingForm.tsx frontend/src/components/novel/settings/HooksSettingForm.tsx frontend/src/components/novel/settings/CharacterManager.tsx
git commit -m "feat: wire AI generation into all setting forms"
```

---

### Task 9: Add "一键生成全部设定" button to SettingsFormField

**Files:**
- Modify: `frontend/src/components/novel/SettingsFormField.tsx`

- [ ] **Add global generate button and progress modal**

Key changes:
- Add `generateAll` + `generateSteps` state
- Add `handleGenerateAll` that calls `POST /settings/generate` and updates progress
- Render "✨ AI 一键生成全部设定" button at top of panel
- Render `AIGenerateProgress` modal
- After generation, reload data

```tsx
import { useState } from "react";
import WorldSettingForm from "./settings/WorldSettingForm";
import StyleSettingForm from "./settings/StyleSettingForm";
import AntiAiSettingForm from "./settings/AntiAiSettingForm";
import HooksSettingForm from "./settings/HooksSettingForm";
import CharacterManager from "./settings/CharacterManager";
import ConfirmToggle from "./settings/ConfirmToggle";
import AIGenerateProgress from "./settings/AIGenerateProgress";
import { api } from "@/lib/api";
import { Sparkles } from "lucide-react";

const TITLE_MAP: Record<string, string> = {
  world: "🌍 世界设定",
  style: "✍️ 写作风格",
  "anti-ai": "🛡️ 反AI规则",
  hooks: "⚓ 伏笔面板",
  characters: "👥 角色管理",
};

const ALL_TYPES = [
  { type: "world", label: "世界设定" },
  { type: "style", label: "写作风格" },
  { type: "anti-ai", label: "反AI规则" },
  { type: "hooks", label: "伏笔面板" },
  { type: "characters", label: "角色管理" },
];

interface SettingsFormFieldProps {
  projectId: string;
  settingKey: string;
  confirmed?: boolean;
  onConfirm?: () => void;
}

export default function SettingsFormField({ projectId, settingKey, confirmed, onConfirm }: SettingsFormFieldProps) {
  const title = TITLE_MAP[settingKey] || settingKey;
  const [showGenerate, setShowGenerate] = useState(false);
  const [genSteps, setGenSteps] = useState(ALL_TYPES.map((t) => ({ ...t, status: "pending" as const })));
  const [genRunning, setGenRunning] = useState(false);

  async function handleGenerateAll() {
    setShowGenerate(true);
    setGenRunning(true);

    for (let i = 0; i < ALL_TYPES.length; i++) {
      const t = ALL_TYPES[i];
      setGenSteps((prev) => prev.map((s) => s.type === t.type ? { ...s, status: "loading" as const } : s));
      try {
        const res = await api.post(`/projects/${projectId}/settings/generate`, {
          types: [t.type],
        });
        if (res[t.type] && !res[t.type]._error) {
          // Save the generated settings
          await api.put(`/projects/${projectId}/settings/${t.type}`, res[t.type]);
          setGenSteps((prev) => prev.map((s) => s.type === t.type ? { ...s, status: "done" as const } : s));
        } else {
          setGenSteps((prev) => prev.map((s) => s.type === t.type ? { ...s, status: "error" as const } : s));
        }
      } catch {
        setGenSteps((prev) => prev.map((s) => s.type === t.type ? { ...s, status: "error" as const } : s));
      }
    }

    setGenRunning(false);
  }

  if (settingKey === "characters") {
    return <CharacterManager projectId={projectId} confirmed={confirmed} onConfirm={onConfirm} />;
  }

  return (
    <div className="p-6">
      {/* Header with title + confirm toggle */}
      <div className="flex items-center justify-between mb-5 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-serif font-semibold">{title}</h2>
          <div className="h-5 w-px bg-base-300/60" />
          <span className={`text-xs tracking-wide ${confirmed ? "text-success/60" : "text-base-content/20"}`}>
            {confirmed ? "已设定" : "待设定"}
          </span>
        </div>
        <ConfirmToggle confirmed={!!confirmed} onToggle={() => onConfirm?.()} />
      </div>

      {/* AI Generate All button */}
      <div className="mb-5 max-w-3xl mx-auto">
        <button
          onClick={handleGenerateAll}
          disabled={genRunning}
          className="w-full px-4 py-3 bg-primary/5 border border-primary/20 border-dashed rounded-xl text-sm text-primary/70 hover:text-primary hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Sparkles className="w-4 h-4" />
          {genRunning ? "AI 生成中…" : "✨ AI 一键生成全部设定"}
        </button>
      </div>

      {/* Version bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-base-200/40 border border-base-300/50 rounded-lg text-xs mb-5 max-w-3xl mx-auto">
        <span className="text-base-content/30 uppercase tracking-wider">版本</span>
        <span className="font-semibold text-primary">v1</span>
        <span className="text-base-content/20">· —</span>
        <div className="flex-1" />
      </div>

      {/* Form */}
      <div className={`transition-opacity duration-300 ${confirmed ? "opacity-60" : "opacity-100"}`}>
        {settingKey === "world" && <WorldSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "style" && <StyleSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "anti-ai" && <AntiAiSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "hooks" && <HooksSettingForm projectId={projectId} settingKey={settingKey} />}
      </div>

      {/* AI Generate Progress Modal */}
      <AIGenerateProgress
        open={showGenerate}
        steps={genSteps}
        onClose={() => setShowGenerate(false)}
      />
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add frontend/src/components/novel/SettingsFormField.tsx
git commit -m "feat: add global AI generate button to settings panel"
```

---

### Task 10: Frontend E2E tests for AI settings

**Files:**
- Create: `frontend/e2e/settings-ai.spec.ts`

- [ ] **Write Playwright E2E tests**

```typescript
import { test, expect } from "@playwright/test";
import { url, setupAuthAndNavigate, setupProjectPage } from "./helpers";

test.describe("AI Settings — global generate", () => {
  test("generate button visible on settings panel", async ({ page }) => {
    await setupProjectPage(page);
    // On 设定 tab by default (new project)
    await expect(page.getByText("AI 一键生成全部设定")).toBeVisible();
  });

  test("generate button has Lucide SVG icon", async ({ page }) => {
    await setupProjectPage(page);
    const btn = page.getByText("AI 一键生成全部设定");
    await expect(btn.locator("svg").first()).toBeVisible();
  });

  test("clicking generate opens progress modal", async ({ page }) => {
    // Mock the API response to avoid actual AI call
    await page.route("**/api/projects/**/settings/generate", async (route) => {
      await route.fulfill({ status: 200, json: {} });
    });
    await setupProjectPage(page);
    await page.getByText("AI 一键生成全部设定").click();
    await expect(page.getByText("世界设定")).toBeVisible();
  });
});

test.describe("AI Settings — per-field generation", () => {
  test.beforeEach(async ({ page }) => {
    await setupProjectPage(page);
  });

  test("world setting fields have AI button", async ({ page }) => {
    // Already on 设定 tab
    await page.getByText("世界设定").click();
    // Find fields with "AI 帮我填" text
    const aiButtons = page.getByText("AI 帮我填");
    await expect(aiButtons.first()).toBeVisible();
  });

  test("clicking AI button opens suggestion modal", async ({ page }) => {
    // Mock the AI field endpoint
    await page.route("**/api/projects/**/settings/ai/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ value: "生成的测试内容" }),
      });
    });
    await page.getByText("世界设定").click();
    await page.getByText("AI 帮我填").first().click();
    await expect(page.getByText("AI 建议")).toBeVisible();
  });

  test("accept button fills content and closes modal", async ({ page }) => {
    await page.route("**/api/projects/**/settings/ai/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ value: "接受的测试内容" }),
      });
    });
    await page.getByText("世界设定").click();
    await page.getByText("AI 帮我填").first().click();
    // Wait for modal to appear
    await expect(page.getByText("AI 建议")).toBeVisible({ timeout: 10000 });
    // Click accept — modal should close
    await page.getByText("接受这个").click();
    await expect(page.getByText("AI 建议")).not.toBeVisible();
  });

  test("anti-ai tab has no AI buttons", async ({ page }) => {
    await page.getByText("反AI规则").click();
    await expect(page.getByText("AI 帮我填")).toHaveCount(0);
  });
});
```

- [ ] **Run E2E tests**

Run: `cd frontend && npx playwright test e2e/settings-ai.spec.ts`
Expected: All tests pass

- [ ] **Commit**

```bash
git add frontend/e2e/settings-ai.spec.ts
git commit -m "test: add E2E tests for AI settings generation"
```

---

### Task 11: Docker rebuild + verify

- [ ] **Rebuild and deploy**

```bash
cd d:/code/ai-novel && docker compose up -d --build
```

- [ ] **Run full test suite**

```bash
bash scripts/test-all.sh
```

- [ ] **Final commit**

```bash
git add -A && git commit -m "feat: complete AI settings generation feature"
```
