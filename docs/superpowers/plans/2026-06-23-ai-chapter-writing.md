# AI Chapter Writing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable AI-powered chapter writing in the ChapterEditor with a view switcher between prose and assembled prompt, SSE streaming output, and versioned saves.

**Architecture:** Backend builds a `ChapterContext` object from premise + settings + outline + character data, assembles a full writing prompt, streams AI output via SSE. Frontend adds prose/prompt tab switcher, AI write button with streaming display, and prompt viewer.

**Tech Stack:** Python/FastAPI + SSE (backend), React 19 + TypeScript + daisyUI (frontend), pytest + Playwright (tests)

---

## File Structure

### Backend — Create

| File | Purpose |
|------|---------|
| `backend/write/chapter_writer.py` | `ChapterContext` builder + prompt assembly |

### Backend — Modify

| File | Change |
|------|--------|
| `backend/write/router.py` | Add `POST /write` SSE streaming endpoint |
| `backend/main.py` | Nothing — already imports write router |

### Frontend — Create

| File | Purpose |
|------|---------|
| `frontend/src/lib/ai.ts` | SSE stream reader for AI chapter writing |

### Frontend — Modify

| File | Change |
|------|--------|
| `frontend/src/components/novel/ChapterEditor.tsx` | Add view tabs (prose/prompt), AI write button, streaming display, prompt viewer |

### Tests — Create

| File | Purpose |
|------|---------|
| `backend/tests/test_chapter_writer.py` | Unit tests for ChapterContext building |
| `frontend/e2e/writing.spec.ts` | E2E tests for AI writing UI |

---

### Task 1: Backend ChapterContext builder

**Files:**
- Create: `backend/write/chapter_writer.py`

- [ ] **Create chapter_writer.py**

```python
"""ChapterContext builder — assembles all writing context into a prompt."""

from filesystem.storage import get_storage


class ChapterContext:
    """Holds all context data needed for writing a chapter."""

    def __init__(self):
        self.premise = ""
        self.world_setting = {}
        self.style_setting = {}
        self.anti_ai = {}
        self.hooks = []
        self.volume_summary = ""
        self.chapter_outline = {}
        self.characters = []
        self.previous_chapter_recap = ""
        self.novel_title = ""

    def to_prompt(self) -> str:
        """Assemble full writing prompt from all context data."""
        lines = []

        # Role
        role = self.style_setting.get("role", "一位小说家")
        principles = self.style_setting.get("core_principles", [])
        lines.append("## 角色定位")
        lines.append(f"你是{role}。{' '.join(principles)}")
        lines.append("")

        # Rules
        mistakes = self.style_setting.get("common_mistakes", [])
        fatigue = self._flatten_fatigue_words(self.anti_ai.get("fatigue_words_zh", {}))
        tic_patterns = [
            r.get("pattern", "") for r in self.anti_ai.get("sentence_rules", [])
        ]
        lines.append("## 原则与禁忌")
        if mistakes:
            lines.append(f"注意避免：{', '.join(mistakes)}")
        if fatigue:
            lines.append(f"禁止使用以下词汇：{', '.join(fatigue)}")
        if tic_patterns:
            lines.append(f"禁止以下句式：{', '.join(tic_patterns[:5])}")
        lines.append("")

        # Background
        lines.append("## 故事背景")
        lines.append(f"本段是《{self.novel_title}》的一章。")
        if self.premise:
            lines.append(f"故事前提：{self.premise}")
        world = self.world_setting
        if world:
            summary_parts = []
            for key in ["geography", "politics", "rules"]:
                val = world.get(key, {})
                if isinstance(val, dict):
                    for sub in val.values():
                        if isinstance(sub, str) and len(sub) > 5:
                            summary_parts.append(sub)
                            break
            if summary_parts:
                lines.append(f"世界观：{' '.join(summary_parts[:3])}")
        if self.volume_summary:
            lines.append(f"本卷概要：{self.volume_summary}")
        lines.append("")

        # Chapter outline
        outline = self.chapter_outline
        lines.append("## 当前章节")
        lines.append(f"章纲：{outline.get('summary', '')}")
        key_points = outline.get("key_points", [])
        if key_points:
            lines.append(f"关键情节点：{'、'.join(key_points[:5])}")
        lines.append("")

        # Previous chapter recap
        if self.previous_chapter_recap:
            lines.append("## 前文回顾")
            lines.append(self.previous_chapter_recap)
            lines.append("")

        # Character snapshots
        if self.characters:
            lines.append("## 角色状态")
            for ch in self.characters[:5]:
                lines.append(f"- {ch.get('name', '?')}：{ch.get('state', '')}")
            lines.append("")

        # Active hooks
        if self.hooks:
            lines.append("## 活跃伏笔")
            for h in self.hooks[:8]:
                lines.append(f"- {h.get('description', '?')}")
            lines.append("")

        # Writing requirements
        techniques = self.style_setting.get("depiction_techniques", {})
        lines.append("## 写作要求")
        if isinstance(techniques, dict):
            for k, v in techniques.items():
                if isinstance(v, str) and v:
                    lines.append(f"- {k}：{v}")
        lines.append("输出长度：约 2500 字。")
        lines.append("语言：中文。")
        lines.append("写正文，不写章节标题，不写总结。")

        return "\n".join(lines)

    def _flatten_fatigue_words(self, fatigue_dict: dict) -> list[str]:
        words = []
        for category in fatigue_dict.values():
            if isinstance(category, list):
                words.extend(category)
        return words


async def build_chapter_context(root_path: str, chapter_ref: str, novel_title: str = "") -> ChapterContext:
    """Read all data sources and build a ChapterContext."""
    ctx = ChapterContext()
    ctx.novel_title = novel_title

    # Premise
    story = await get_storage().read_yaml(root_path, "story.yaml") or {}
    ctx.premise = story.get("synopsis", "")

    # Settings
    ctx.world_setting = await get_storage().read_yaml(root_path, "settings/world-setting.yaml") or {}
    ctx.style_setting = await get_storage().read_yaml(root_path, "settings/writing-style.yaml") or {}
    ctx.anti_ai = await get_storage().read_yaml(root_path, "settings/anti-ai.yaml") or {}

    # Hooks
    hooks_data = await get_storage().read_yaml(root_path, "settings/hooks.yaml") or {}
    ctx.hooks = hooks_data.get("active", [])

    # Chapter
    chapter = await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml") or {}
    ctx.chapter_outline = chapter.get("outline", {})
    if not isinstance(ctx.chapter_outline, dict):
        ctx.chapter_outline = {}

    # Volume info
    vol_match = __import__("re").match(r"vol-(\d+)", chapter_ref)
    if vol_match:
        vol_num = vol_match.group(1)
        vol_data = await get_storage().read_yaml(root_path, f"volumes/vol-{vol_num}.yaml") or {}
        ctx.volume_summary = vol_data.get("summary", "")

    # Characters in this chapter
    char_names = ctx.chapter_outline.get("characters", [])
    if isinstance(char_names, list):
        for name in char_names[:5]:
            if isinstance(name, str):
                ch_data = await get_storage().read_yaml(root_path, f"settings/character-setting/{name}.yaml") or {}
                state = ""
                state_history = ch_data.get("state_history", [])
                if isinstance(state_history, list) and state_history:
                    last = state_history[-1]
                    if isinstance(last, dict):
                        state = last.get("state", "")
                ctx.characters.append({"name": name, "state": state})

    # Previous chapter recap
    ch_num = chapter.get("chapter", 0)
    vol_num_match = __import__("re").match(r"vol-(\d+)", chapter_ref)
    if vol_num_match and ch_num > 1:
        prev_ref = f"vol-{vol_num_match.group(1)}-ch-{ch_num - 1}"
        prev = await get_storage().read_yaml(root_path, f"chapters/{prev_ref}.yaml") or {}
        prev_prose = prev.get("prose", "")
        if prev_prose:
            ctx.previous_chapter_recap = prev_prose[-500:]

    return ctx
```

- [ ] **Run import check**

```bash
cd d:\code\ai-novel\backend && python -c "from write.chapter_writer import ChapterContext, build_chapter_context; print('OK')"
```

- [ ] **Commit**

```bash
git add backend/write/chapter_writer.py
git commit -m "feat: add ChapterContext builder for AI chapter writing"
```

---

### Task 2: Backend SSE writing endpoint

**Files:**
- Modify: `backend/write/router.py`

- [ ] **Add POST /write endpoint**

Read `d:\code\ai-novel\backend\write\router.py` first. Then add the new endpoint after the existing ones.

```python
@router.post("/write")
async def write_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream an AI-written chapter based on all context data."""
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    from write.chapter_writer import build_chapter_context
    from ai_client import get_ai_client

    ctx = await build_chapter_context(project.root_path, chapter_ref, project.name)
    prompt = ctx.to_prompt()

    # Save prompt for review
    await get_storage().write_md(
        project.root_path, f"prompts/{chapter_ref}-write-prompt.md", prompt
    )

    update_phase(project, "write")
    await db.commit()

    return StreamingResponse(
        _stream_chapter(project.root_path, chapter_ref, ctx, prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _stream_chapter(root_path: str, chapter_ref: str, ctx, prompt: str):
    """Generate chapter text via AI streaming, save on completion."""
    from ai_client import get_ai_client
    from workflow.engine import load_chapter

    client = get_ai_client()
    model = ctx.style_setting.get("writing_model", "haiku")
    role = ctx.style_setting.get("role", "一位小说家")
    full_text = ""

    async for event in client.chat_stream(
        model=model,
        system=role,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8192,
    ):
        if event.text:
            full_text += event.text
            yield f"data: {json.dumps({'type': 'chunk', 'text': event.text}, ensure_ascii=False)}\n\n"
        elif event.is_done:
            # Save prose to chapter
            chapter = await load_chapter(root_path, chapter_ref)
            chapter["prose"] = full_text
            await get_storage().write_yaml(
                root_path, f"chapters/{chapter_ref}.yaml", chapter
            )
            yield f"data: {json.dumps({'type': 'done', 'full_text': full_text, 'tokens': event.tokens}, ensure_ascii=False)}\n\n"
        elif event.error:
            yield f"data: {json.dumps({'type': 'error', 'error': event.error}, ensure_ascii=False)}\n\n"
```

Note: Need to add `import json` at the top of router.py if not already there.

- [ ] **Verify the endpoint is accessible**

Run: `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/projects/fake/chapters/fake/write -H "Authorization: Bearer test"`

Expected: 401 or 404 (auth check, not server error)

- [ ] **Commit**

```bash
git add backend/write/router.py
git commit -m "feat: add POST /write SSE endpoint for full chapter generation"
```

---

### Task 3: Frontend SSE stream reader

**Files:**
- Create: `frontend/src/lib/ai.ts`

- [ ] **Create ai.ts with SSE helper**

```typescript
import { getToken } from "./auth";
import { getApiBaseUrl } from "./env";

const API_BASE = `${getApiBaseUrl()}/api`;

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

export function streamChapterWrite(
  projectId: string,
  chapterRef: string,
  callbacks: StreamCallbacks,
): AbortController {
  const controller = new AbortController();
  const token = getToken();

  fetch(`${API_BASE}/projects/${projectId}/chapters/${chapterRef}/write`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      callbacks.onError(err.detail || "写作出错");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("无法读取响应流");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "chunk") {
            callbacks.onChunk(data.text);
          } else if (data.type === "done") {
            callbacks.onDone(data.full_text);
          } else if (data.type === "error") {
            callbacks.onError(data.error);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  }).catch((err) => {
    if (err.name !== "AbortError") {
      callbacks.onError(err.message || "网络错误");
    }
  });

  return controller;
}
```

- [ ] **TypeScript check**

```bash
cd d:\code\ai-novel\frontend && npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add frontend/src/lib/ai.ts
git commit -m "feat: add SSE stream reader for AI chapter writing"
```

---

### Task 4: Frontend ChapterEditor — view tabs + AI write button + streaming

**Files:**
- Modify: `frontend/src/components/novel/ChapterEditor.tsx`

This is the largest task. The ChapterEditor needs:

1. A tab bar to switch between 正文 (prose) and 提示词 (prompt) views
2. An "✨ AI 写本章" button in the prose view
3. Streaming output display (typing effect)
4. Prompt viewer (read-only, monospace, with copy button)
5. Loading/streaming states
6. Stop streaming functionality

Key additions to the component state:
- `viewTab: "prose" | "prompt"`
- `streaming: boolean` - is AI currently generating
- `streamedText: string` - accumulated AI output
- `promptText: string` - the assembled prompt (loaded after AI write)

The structure should be:

```
// View tabs at top of content area
<TabBar tabs={[
  { id: "prose", label: "正文" },
  { id: "prompt", label: "提示词" },
]} activeTab={viewTab} onTabChange={setViewTab} />

{viewTab === "prose" && (
  <div>
    {!streaming && (
      <button onClick={startWriting}>✨ AI 写本章</button>
    )}
    {streaming ? (
      <div className="streaming-output">
        {streamedText}<span className="cursor">|</span>
      </div>
      <button onClick={stopWriting}>⏹ 停止</button>
    ) : (
      <textarea value={prose} ... />
    )}
  </div>
)}

{viewTab === "prompt" && (
  <div>
    <pre>{promptText}</pre>
    <button onClick={copyPrompt}>📋 复制</button>
  </div>
)}
```

The AI write flow:
1. Click "✨ AI 写本章" → call `streamChapterWrite()`
2. Chunks accumulate in `streamedText` state
3. Done → set `prose` to full text, save auto
4. Then fetch the prompt text from `GET /prompts/{chapter_ref}-write-prompt.md` (or build it on the frontend from saved version)

For the implementation:
- Read the existing ChapterEditor code first
- Add new state variables
- Add the TabBar import (already exists in FormField.tsx)
- Wire the streaming logic
- Add CSS for the cursor animation

See the existing `frontend/src/components/novel/ChapterEditor.tsx` for the current component structure. Follow its patterns.

After implementation, the TypeScript check must pass.

- [ ] **Commit**

```bash
git add frontend/src/components/novel/ChapterEditor.tsx
git commit -m "feat: add AI chapter writing with prose/prompt view switching"
```

---

### Task 5: Backend tests for ChapterContext

**Files:**
- Create: `backend/tests/test_chapter_writer.py`

- [ ] **Write test file**

```python
"""Tests for ChapterContext builder."""

import pytest
from write.chapter_writer import ChapterContext


class TestChapterContext:
    def test_empty_context_returns_valid_prompt(self):
        ctx = ChapterContext()
        prompt = ctx.to_prompt()
        assert isinstance(prompt, str)
        assert len(prompt) > 50
        assert "## 角色定位" in prompt
        assert "## 原则与禁忌" in prompt
        assert "## 故事背景" in prompt
        assert "## 写作要求" in prompt

    def test_with_premise(self):
        ctx = ChapterContext()
        ctx.premise = "一个退役刑警调查悬案的故事"
        ctx.novel_title = "暗流"
        prompt = ctx.to_prompt()
        assert "暗流" in prompt
        assert "退役刑警" in prompt

    def test_with_world_setting(self):
        ctx = ChapterContext()
        ctx.world_setting = {
            "geography": {"scenes": "潮湿的南方城市"},
            "politics": {"rule": "军阀割据"},
            "rules": {"world": "没有超自然力量"},
        }
        prompt = ctx.to_prompt()
        assert "潮湿的南方城市" in prompt

    def test_with_style_settings(self):
        ctx = ChapterContext()
        ctx.style_setting = {
            "role": "冷峻的叙事者",
            "core_principles": ["简洁", "有力"],
            "common_mistakes": ["不要滥用形容词"],
            "depiction_techniques": {"action": "快速剪辑"},
        }
        prompt = ctx.to_prompt()
        assert "冷峻的叙事者" in prompt
        assert "不要滥用形容词" in prompt
        assert "快速剪辑" in prompt

    def test_with_hooks(self):
        ctx = ChapterContext()
        ctx.hooks = [
            {"description": "神秘信件"},
            {"description": "失踪的钥匙"},
        ]
        prompt = ctx.to_prompt()
        assert "神秘信件" in prompt
        assert "失踪的钥匙" in prompt

    def test_with_characters(self):
        ctx = ChapterContext()
        ctx.characters = [
            {"name": "张三", "state": "正在调查案件"},
            {"name": "李四", "state": "隐藏身份中"},
        ]
        prompt = ctx.to_prompt()
        assert "张三" in prompt
        assert "李四" in prompt

    def test_flatten_fatigue_words(self):
        ctx = ChapterContext()
        result = ctx._flatten_fatigue_words({
            "副词": ["突然", "忽然"],
            "语气词": ["嗯", "啊"],
        })
        assert "突然" in result
        assert "啊" in result
        assert len(result) == 4

    def test_with_previous_chapter_recap(self):
        ctx = ChapterContext()
        ctx.previous_chapter_recap = "上一章结尾，张三推开了那扇门。"
        prompt = ctx.to_prompt()
        assert "上一章结尾" in prompt
```

- [ ] **Run tests**

```bash
cd d:\code\ai-novel\backend && python -m pytest tests/test_chapter_writer.py -v
```
Expected: 8 passed

- [ ] **Commit**

```bash
git add backend/tests/test_chapter_writer.py
git commit -m "test: add unit tests for ChapterContext builder"
```

---

### Task 6: Frontend E2E tests for AI writing

**Files:**
- Create: `frontend/e2e/writing.spec.ts`

- [ ] **Write E2E test file**

```typescript
import { test, expect } from "@playwright/test";
import { url, setupProjectPage, createTestUser, setToken } from "./helpers";

test.describe("AI Writing", () => {
  test.beforeEach(async ({ page }) => {
    await setupProjectPage(page);
  });

  test("view tabs (正文/提示词) are visible in chapter editor", async ({ page }) => {
    // Navigate to a project and open the writing tab
    await page.getByRole("button", { name: "正文" }).click();
    // Create a volume + chapter via UI
    await page.getByText("直接写第一章").click();
    await page.waitForTimeout(3000);

    // Check that the prose/prompt tabs exist
    await expect(page.getByText("正文").first()).toBeVisible();
    await expect(page.getByText("提示词")).toBeVisible();
  });

  test("switching to 提示词 tab shows placeholder", async ({ page }) => {
    await page.getByRole("button", { name: "正文" }).click();
    await page.getByText("直接写第一章").click();
    await page.waitForTimeout(3000);

    await page.getByText("提示词").click();
    // Should show the prompt content or a placeholder
    await expect(page.locator("pre, textarea").first()).toBeVisible();
  });

  test("AI write button is visible in prose tab", async ({ page }) => {
    await page.getByRole("button", { name: "正文" }).click();
    await page.getByText("直接写第一章").click();
    await page.waitForTimeout(3000);

    await expect(page.getByText(/AI 写本章/)).toBeVisible();
  });

  test("clicking AI write with mock SSE shows streaming output", async ({ page }) => {
    // Mock the SSE endpoint
    await page.route("**/api/projects/**/write", async (route) => {
      const body = `data: ${JSON.stringify({ type: "chunk", text: "测试输出" })}\n\ndata: ${JSON.stringify({ type: "done", full_text: "测试输出" })}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body,
      });
    });

    await page.getByRole("button", { name: "正文" }).click();
    await page.getByText("直接写第一章").click();
    await page.waitForTimeout(3000);

    await page.getByText(/AI 写本章/).click();
    await expect(page.getByText("测试输出")).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Run the tests**

```bash
cd d:\code\ai-novel\frontend && npx playwright test e2e/writing.spec.ts
```

Fix any failures and re-run until all pass.

- [ ] **Commit**

```bash
git add frontend/e2e/writing.spec.ts
git commit -m "test: add E2E tests for AI chapter writing"
```

---

### Task 7: Docker rebuild + full test suite

- [ ] **Rebuild Docker**

```bash
cd d:\code\ai-novel && docker compose up -d --build
```

- [ ] **Run backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

- [ ] **Run frontend E2E tests**

```bash
cd frontend && npx playwright test
```

- [ ] **Final commit**

```bash
git add -A && git commit -m "feat: complete AI chapter writing feature"
```
