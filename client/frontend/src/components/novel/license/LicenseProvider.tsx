import { createContext, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface TierState {
  tier: string;
  isFree: boolean;
  isPro: boolean;
  trialRemainingDays: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface VerifyResponse {
  tier?: string;
  trial_remaining_days?: number;
}

// module 级缓存：同会话多 Provider/重挂载不重复请求（/auth/verify 仅 1 次）。
let cachedVerify: VerifyResponse | null = null;

const TierContext = createContext<TierState | null>(null);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState(cachedVerify?.tier ?? "none");
  const [trialRemainingDays, setTrialRemainingDays] = useState(
    cachedVerify?.trial_remaining_days ?? 0,
  );
  const [loading, setLoading] = useState(!cachedVerify);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (useCache: boolean) => {
    if (useCache && cachedVerify) {
      setTier(cachedVerify.tier ?? "none");
      setTrialRemainingDays(cachedVerify.trial_remaining_days ?? 0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = (await api.post("/auth/verify")) as VerifyResponse;
      cachedVerify = r;
      setTier(r.tier ?? "none");
      setTrialRemainingDays(r.trial_remaining_days ?? 0);
      setError(null);
    } catch {
      cachedVerify = null; // 失败不缓存，允许重试
      setTier("none"); // 免费兜底，不抛 500
      setError("套餐校验失败，已按免费处理");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const refetch = useCallback(() => {
    cachedVerify = null;
    void load(false);
  }, [load]);

  const isFree = tier === "none";
  const value: TierState = {
    tier,
    isFree,
    isPro: !isFree,
    trialRemainingDays,
    loading,
    error,
    refetch,
  };
  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

export { TierContext };
