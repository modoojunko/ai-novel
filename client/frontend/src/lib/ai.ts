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
