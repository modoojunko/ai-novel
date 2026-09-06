import { useCallback, useEffect, useState } from "react";
import type { ApiConfig } from "../types/api-config";
import { getToken } from "../lib/auth";

const API_BASE = "/api/v1";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

export function useApiConfigs() {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api-configs`, { headers: authHeaders() });
      if (resp.status === 503) {
        // 本页就是 /config：503 只会是云托管冷启动，就地报错不强跳
        throw new Error("云端服务唤醒中，请稍后重试");
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setConfigs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load configs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const addConfig = async (body: {
    name: string;
    vendor_id: string;
    base_url: string;
    api_key: string;
    api_format: "openai" | "anthropic";
  }): Promise<ApiConfig> => {
    const resp = await fetch(`${API_BASE}/api-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (resp.status === 409) throw new Error("名称已被使用");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const config = await resp.json();
    setConfigs((prev) => [config, ...prev]);
    return config;
  };

  const updateConfig = async (
    id: string,
    body: Record<string, any>,
  ): Promise<ApiConfig> => {
    const resp = await fetch(`${API_BASE}/api-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (resp.status === 409) throw new Error("名称已被使用");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const config = await resp.json();
    setConfigs((prev) => prev.map((c) => (c.id === id ? config : c)));
    return config;
  };

  const deleteConfig = async (
    id: string,
  ): Promise<{ affected_projects: number; affected_names: string[] }> => {
    const resp = await fetch(`${API_BASE}/api-configs/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    return result;
  };

  const restoreConfig = async (id: string): Promise<ApiConfig> => {
    // 撤销删除：后端软删后 restore 复活同一 id
    const resp = await fetch(`${API_BASE}/api-configs/${id}/restore`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const config = await resp.json();
    setConfigs((prev) => [config, ...prev]);
    return config;
  };

  const refresh = fetchConfigs;

  const refreshStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api-configs/status`, { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setConfigs((prev) =>
          prev.map((c) => {
            const statusEntry = data.find((s: any) => s.id === c.id);
            return statusEntry
              ? {
                  ...c,
                  last_test_status: statusEntry.last_test_status,
                  models: statusEntry.models,
                }
              : c;
          }),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshModels = async (id: string) => {
    const resp = await fetch(`${API_BASE}/api-configs/${id}/refresh-models`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  };

  const testConfig = async (id: string): Promise<{ ok: boolean; status: string; models?: string[]; error?: string }> => {
    const resp = await fetch(`${API_BASE}/api-configs/${id}/test`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    // Refresh configs to pick up persisted test status
    if (result.ok || result.status) {
      setConfigs((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, last_test_status: result.status, models: result.models ?? c.models }
            : c,
        ),
      );
    }
    return result;
  };

  const testRawConfig = async (body: {
    vendor_id: string;
    base_url: string;
    api_key: string;
    api_format: "openai" | "anthropic";
  }): Promise<{ ok: boolean; status: string; models?: string[]; error?: string }> => {
    const resp = await fetch(`${API_BASE}/api-configs/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  };

  return {
    configs,
    loading,
    error,
    addConfig,
    updateConfig,
    deleteConfig,
    restoreConfig,
    refresh,
    refreshStatus,
    refreshModels,
    testConfig,
    testRawConfig,
  };
}
