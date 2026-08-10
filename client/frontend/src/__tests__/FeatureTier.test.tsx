import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  TierContext,
  type TierState,
} from "@/components/novel/license/LicenseProvider";
import { TierGate, TierField } from "@/components/novel/license/FeatureTier";

/** 同步注入指定套餐，免去 /auth/verify 异步。 */
function TestTierProvider({
  tier,
  children,
}: {
  tier: string;
  children: ReactNode;
}) {
  const isFree = tier === "none";
  const value: TierState = {
    tier,
    isFree,
    isPro: !isFree,
    trialRemainingDays: 0,
    loading: false,
    error: null,
    refetch: () => {},
  };
  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

describe("TierGate", () => {
  it("免费态不渲染 AI 子树", () => {
    render(
      <TestTierProvider tier="none">
        <TierGate feature="ai-generate">
          <button>AI 生成</button>
        </TierGate>
      </TestTierProvider>,
    );
    expect(screen.queryByText("AI 生成")).toBeNull();
  });

  it("付费态渲染 AI 子树", () => {
    render(
      <TestTierProvider tier="monthly">
        <TierGate feature="ai-generate">
          <button>AI 生成</button>
        </TierGate>
      </TestTierProvider>,
    );
    expect(screen.getByText("AI 生成")).toBeDefined();
  });
});

describe("TierField", () => {
  it("免费态显示锁标且字段骨架保留", () => {
    render(
      <TestTierProvider tier="none">
        <TierField feature="settings-ai-fields" locked>
          <input aria-label="目标读者" />
        </TierField>
      </TestTierProvider>,
    );
    expect(screen.getByText(/🔒 属 PRO/)).toBeDefined();
    expect(screen.getByLabelText("目标读者")).toBeDefined();
    // pointer-events 禁用交互
    const field = screen.getByLabelText("目标读者").closest(
      "div[data-feature-locked]",
    );
    expect(field).not.toBeNull();
    expect(field?.className).toContain("pointer-events-none");
  });

  it("付费态正常渲染、无锁标", () => {
    render(
      <TestTierProvider tier="monthly">
        <TierField feature="settings-ai-fields" locked>
          <input aria-label="目标读者" />
        </TierField>
      </TestTierProvider>,
    );
    expect(screen.queryByText(/🔒 属 PRO/)).toBeNull();
    expect(screen.getByLabelText("目标读者")).toBeDefined();
  });
});
