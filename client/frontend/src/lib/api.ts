import { getToken } from "./auth";

import { getApiBaseUrl } from "./env";

const BASE = `${getApiBaseUrl()}/api`;

/** Fetch wrapper that redirects to /config on 503 (AI config required). */
export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const resp = await fetch(input, init);
  if (resp.status === 503) {
    window.location.href = "/#/config";
    throw new Error('Service unavailable');
  }
  return resp;
}

export async function request(
  path: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    /** 静默能力探测：不触发全局副作用（member_required 升级弹窗、503 跳转 /config） */
    quiet?: boolean;
  },
): Promise<any> {
  const method = options?.method || 'GET';
  const headers: Record<string, string> = { ...(options?.headers || {}) };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options?.body,
  });

  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    window.location.href = "/#/login";
    throw new Error("Unauthorized");
  }

  if (res.status === 503) {
    if (!options?.quiet) {
      window.location.href = "/#/config";
    }
    throw new Error('Service unavailable');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // AI 会员拦截：后端 403 detail = {reason: "member_required", message}
    // → 广播全局升级引导（MemberBlockPrompt 监听），错误继续抛给调用方
    if (res.status === 403 && err?.detail?.reason === "member_required") {
      const message = err.detail.message || "AI 是会员功能";
      if (!options?.quiet) {
        window.dispatchEvent(
          new CustomEvent("member-block", { detail: { message } }),
        );
      }
      const e = new Error(message) as Error & { reason?: string; status?: number };
      e.reason = "member_required";
      e.status = res.status;
      throw e;
    }
    // detail 可能是对象（如删除题材 409 的 { message, projects }），透传 projects 供 UI 提示引用项目
    const message =
      typeof err.detail === "string"
        ? err.detail
        : err.detail?.message || res.statusText;
    // 附带 HTTP 状态码：调用方据此区分结构性错误（404/405 端点缺失）与网络/服务端错误
    const e = new Error(message) as Error & { status?: number; projects?: string[] };
    e.status = res.status;
    if (typeof err.detail === "object" && Array.isArray(err.detail.projects)) {
      e.projects = err.detail.projects;
    }
    throw e;
  }

  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) => request(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) => request(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) => request(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
  /** Fetch phase status for a novel. */
  fetchPhaseStatus: (novelId: string) =>
    request(`/novels/${novelId}/workflow/phase-status`),
  /** Create a new novel. */
  createNovel: (body: { name: string; source?: string; synopsis?: string; genre_profile?: string }): Promise<{ id: string; name: string }> =>
    request('/novels', { method: 'POST', body: JSON.stringify(body) }),
  /** Rename a novel (display name only). */
  renameNovel: (novelId: string, name: string): Promise<{ id: string; name: string }> =>
    request(`/novels/${novelId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  /** Read story.yaml synopsis. */
  fetchStory: (novelId: string): Promise<{ synopsis: string }> =>
    request(`/novels/${novelId}/story`),
  /** Write story.yaml synopsis (manual backfill). */
  updateStory: (novelId: string, synopsis: string): Promise<{ ok: boolean; synopsis: string }> =>
    request(`/novels/${novelId}/story`, { method: 'PUT', body: JSON.stringify({ synopsis }) }),
};

// ---------------------------------------------------------------------------
// Import types
// ---------------------------------------------------------------------------

export interface ChapterImportData {
  title: string;
  content?: string;
  word_count?: number;
}

export interface VolumeImportData {
  title: string;
  chapters: ChapterImportData[];
}

export interface ImportPreviewData {
  title: string;
  volumes: VolumeImportData[];
  warnings?: Array<{ type: string; message: string; details?: Record<string, unknown> | null }>;
}

// ---------------------------------------------------------------------------
// Import API — file upload uses raw fetch (multipart FormData)
// ---------------------------------------------------------------------------

export async function importParse(
  file: File,
  signal?: AbortSignal,
): Promise<ImportPreviewData> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/novels/import/parse`, {
    method: "POST",
    body: formData,
    headers,
    signal,
  });
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    window.location.href = "/#/login";
    throw new Error("Unauthorized");
  }
  if (res.status === 503) {
    window.location.href = "/#/config";
    throw new Error("Service unavailable");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export function importPersist(body: {
  name: string;
  volumes: VolumeImportData[];
}) {
  return api.post("/novels/import/persist", body);
}

/** Fetch the import template .md content. */
export async function downloadTemplate(): Promise<string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/novels/import/template`, { headers });
  if (!res.ok) throw new Error("模板下载失败");
  return res.text();
}
