import { useEffect, useState } from "react";
import type { ConnectionStatus } from "../types/api-config";
import { getToken } from "../lib/auth";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

const CACHE_TTL = parseInt(
  import.meta.env.VITE_CACHE_TTL || "30000",
  10,
);
const cache = new Map<string, { data: any; timestamp: number }>();

export function clearConnectionCache() {
  cache.clear();
}

export function useConnectionStatus(configId: string | undefined) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!configId) return;

    const cached = cache.get(configId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setStatus(cached.data);
      setStale(false);
      return;
    }
    if (cached) setStale(true);

    setLoading(true);
    fetch(`/api/v1/api-configs/${configId}/test`, { method: "POST", headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const s = data.status as ConnectionStatus;
        setStatus(s);
        cache.set(configId, { data: s, timestamp: Date.now() });
        setStale(false);
      })
      .catch(() => setStatus("unknown"))
      .finally(() => setLoading(false));
  }, [configId]);

  return { status, loading, stale };
}
