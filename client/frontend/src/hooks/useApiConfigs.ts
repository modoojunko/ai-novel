import { useCallback, useEffect, useState } from "react";
import type { ApiConfig } from "../types/api-config";

const API_BASE = "/api/v1";

export function useApiConfigs() {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api-configs`);
      if (resp.status === 503) {
        window.location.href = "/config";
        return;
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
  }): Promise<ApiConfig> => {
    const resp = await fetch(`${API_BASE}/api-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    return result;
  };

  const refresh = fetchConfigs;

  const refreshStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api-configs/status`);
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
    refresh,
    refreshStatus,
    refreshModels,
  };
}
