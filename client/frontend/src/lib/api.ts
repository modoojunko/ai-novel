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

export async function request(path: string, options?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<any> {
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
    window.location.hash = "#/login";
    throw new Error("Unauthorized");
  }

  if (res.status === 503) {
    window.location.href = "/#/config";
    throw new Error('Service unavailable');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }

  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) => request(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) => request(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};
