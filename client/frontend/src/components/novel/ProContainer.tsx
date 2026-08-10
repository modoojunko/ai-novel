import type { ReactNode } from "react";
import { useTier } from "@/hooks/useTier";

/**
 * PRO 容器（N14）：免费态整棵子树不渲染（含内部 hook 调用），PRO 态原样透传。
 * phase 催促 UI（TABS/GateBanner/OnboardingCard/useNovelState）收进其子树，
 * 免费态零 phase-status 请求、零阶段催促 UI（P0 断点 1 第 8 条）。
 */
export default function ProContainer({ children }: { children: ReactNode }) {
  const { isFree } = useTier();
  if (isFree) return null;
  return <>{children}</>;
}
