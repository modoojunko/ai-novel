import { useContext } from "react";
import { TierContext, type TierState } from "@/components/novel/license/LicenseProvider";

const SAFE_FREE: TierState = {
  tier: "none",
  isFree: true,
  isPro: false,
  trialRemainingDays: 0,
  loading: false,
  error: null,
  refetch: () => {},
};

/** 取当前套餐状态；未包 LicenseProvider 时返回免费安全默认值，不抛。 */
export function useTier(): TierState {
  return useContext(TierContext) ?? SAFE_FREE;
}
