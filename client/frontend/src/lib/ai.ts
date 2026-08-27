import { getToken } from "./auth";
import { getApiBaseUrl } from "./env";

const API_BASE = `${getApiBaseUrl()}/api`;

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  /** meta：done 事件附带的完工检查（ai-prompt-crafting 三工序③） */
  onDone: (fullText: string, meta?: StreamDoneMeta) => void;
  onError: (error: string) => void;
}

/** 字数校验（目标 ±10% 口径；below_limit = 低于目标 90%） */
export interface WordCheck {
  target: number;
  actual: number;
  below_limit: boolean;
  message?: string;
}

/** 叙事自查命中的规则（提示性质，非阻断） */
export interface SelfCheckIssue {
  rule: string;
  excerpts: string[];
}

export interface StreamDoneMeta {
  word_check?: WordCheck;
  self_check?: SelfCheckIssue[];
}

// ---------------------------------------------------------------------------
// Streaming SSE helpers
// ---------------------------------------------------------------------------

export function streamChapterWrite(
  projectId: string,
  chapterRef: string,
  callbacks: StreamCallbacks,
  promptOverride?: string,
): AbortController {
  // promptOverride：AI 弹窗编辑后的提示词覆盖（空串/未传 = 后端自动组装）
  return doStreamFetch(
    `${API_BASE}/novels/${projectId}/chapters/${chapterRef}/write`,
    promptOverride ? { prompt: promptOverride } : undefined,
    callbacks,
  );
}

export function streamChapterContinue(
  projectId: string,
  chapterRef: string,
  cursorPosition: number,
  callbacks: StreamCallbacks,
): AbortController {
  return doStreamFetch(
    `${API_BASE}/novels/${projectId}/chapters/${chapterRef}/write/continue`,
    { cursor_position: cursorPosition },
    callbacks,
  );
}

function doStreamFetch(
  url: string,
  body: Record<string, unknown> | undefined,
  callbacks: StreamCallbacks,
): AbortController {
  const controller = new AbortController();
  const token = getToken();

  const init: RequestInit & { signal: AbortSignal } = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  };

  if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  fetch(url, init)
    .then(async (response) => {
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
              callbacks.onDone(data.full_text, {
                word_check: data.word_check,
                self_check: data.self_check,
              });
            } else if (data.type === "error") {
              callbacks.onError(data.error);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        callbacks.onError(err.message || "网络错误");
      }
    });

  return controller;
}

// ---------------------------------------------------------------------------
// Non-streaming AI helpers (polish / expand)
// ---------------------------------------------------------------------------

async function doJsonPost(
  url: string,
  body: Record<string, unknown>,
): Promise<any> {
  const token = getToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "请求出错");
  }
  return res.json();
}

export async function polishText(
  projectId: string,
  chapterRef: string,
  selectedText: string,
  contextBefore: string,
  contextAfter: string,
): Promise<string> {
  const data = await doJsonPost(
    `${API_BASE}/novels/${projectId}/chapters/${chapterRef}/write/polish`,
    { selected_text: selectedText, context_before: contextBefore, context_after: contextAfter },
  );
  return data.polished_text;
}

export async function expandText(
  projectId: string,
  chapterRef: string,
  selectedText: string,
  contextBefore: string,
  contextAfter: string,
): Promise<string> {
  const data = await doJsonPost(
    `${API_BASE}/novels/${projectId}/chapters/${chapterRef}/write/expand`,
    { selected_text: selectedText, context_before: contextBefore, context_after: contextAfter },
  );
  return data.expanded_text;
}

// ---------------------------------------------------------------------------
// Two-stage prompt pipeline (ai-prompt-crafting)
// ---------------------------------------------------------------------------

/** AI 润色整章提示词：素材包 → 大模型润色 → 校验落库（后端 502 时不动既有行） */
export async function polishWritePrompt(
  projectId: string,
  chapterRef: string,
): Promise<string> {
  const data = await doJsonPost(
    `${API_BASE}/novels/${projectId}/chapters/${chapterRef}/write/prompt/polish`,
    {},
  );
  return data.prompt as string;
}

// ---------------------------------------------------------------------------
// Outline AI draft (outline-ai-draft)
// ---------------------------------------------------------------------------

/** AI 起草章纲：主线卡+设定+前情 → 结构化草稿（不落库，表单承接；失败 502 可重试） */
export async function draftOutline(
  projectId: string,
  chapterRef: string,
): Promise<Record<string, unknown>> {
  return doJsonPost(
    `${API_BASE}/novels/${projectId}/chapters/${chapterRef}/outline/ai-draft`,
    {},
  );
}
