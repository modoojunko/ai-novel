import { createContext, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface TierState {
  tier: string;
  /** 免费待遇 = 非有效会员（免费层或套餐过期，与后端口径一致） */
  isFree: boolean;
  /** 有效会员（trial/月/季/年/终身，未过期）——AI 能力判据 */
  isMember: boolean;
  /** 套餐已过期（降为免费待遇，前端显示已过期徽标 + 续费引导） */
  expired: boolean;
  expiresAt: string;
  isPro: boolean;
  trialRemainingDays: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface VerifyResponse {
  tier?: string;
  is_member?: boolean;
  expired?: boolean;
  expires_at?: string;
  trial_remaining_days?: number;
}

// module 级缓存：同会话多 Provider/重挂载不重复请求（/auth/verify 仅 1 次）。
let cachedVerify: VerifyResponse | null = null;

const TierContext = createContext<TierState | null>(null);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState(cachedVerify?.tier ?? "none");
  const [isMember, setIsMember] = useState(cachedVerify?.is_member ?? false);
  const [expired, setExpired] = useState(cachedVerify?.expired ?? false);
  const [expiresAt, setExpiresAt] = useState(cachedVerify?.expires_at ?? "");
  const [trialRemainingDays, setTrialRemainingDays] = useState(
    cachedVerify?.trial_remaining_days ?? 0,
  );
  const [loading, setLoading] = useState(!cachedVerify);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (useCache: boolean) => {
    if (useCache && cachedVerify) {
      setTier(cachedVerify.tier ?? "none");
      setIsMember(cachedVerify.is_member ?? false);
      setExpired(cachedVerify.expired ?? false);
      setExpiresAt(cachedVerify.expires_at ?? "");
      setTrialRemainingDays(cachedVerify.trial_remaining_days ?? 0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = (await api.post("/auth/verify")) as VerifyResponse;
      cachedVerify = r;
      setTier(r.tier ?? "none");
      setIsMember(r.is_member ?? false);
      setExpired(r.expired ?? false);
      setExpiresAt(r.expires_at ?? "");
      setTrialRemainingDays(r.trial_remaining_days ?? 0);
      setError(null);
    } catch {
      cachedVerify = null; // 失败不缓存，允许重试
      setTier("none"); // 免费兜底，不抛 500
      setIsMember(false);
      setExpired(false);
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

  // 免费待遇 = 非有效会员（免费层或过期降级）；isPro 同步为有效会员语义
  const value: TierState = {
    tier,
    isFree: !isMember,
    isMember,
    expired,
    expiresAt,
    isPro: isMember,
    trialRemainingDays,
    loading,
    error,
    refetch,
  };
  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

export { TierContext };
