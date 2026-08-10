import type { ReactNode } from "react";
import { isFeatureEnabled, type FeatureKey } from "@/lib/features";
import { useTier } from "@/hooks/useTier";

/** 功能不可用 → 不渲染子树（AI 入口/按钮/整棵 AI 子树隐藏）。 */
export function TierGate({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: ReactNode;
}) {
  const { tier } = useTier();
  if (!isFeatureEnabled(feature, tier)) return null;
  return <>{children}</>;
}

/** 🔒 包装表单字段：禁用态显示锁标 +「属 PRO」，保留字段骨架。locked=false 时仅禁交互不显锁。 */
export function TierField({
  feature,
  locked = true,
  children,
}: {
  feature: FeatureKey;
  locked?: boolean;
  children: ReactNode;
}) {
  const { tier } = useTier();
  if (isFeatureEnabled(feature, tier)) return <>{children}</>;
  return (
    <div
      className="relative opacity-70 pointer-events-none select-none"
      data-feature-locked={feature}
    >
      {locked && (
        <span className="badge badge-sm badge-ghost absolute top-2 right-2 z-10">
          🔒 属 PRO
        </span>
      )}
      {children}
    </div>
  );
}
