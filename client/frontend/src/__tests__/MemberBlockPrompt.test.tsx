import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const apiState = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: apiState }));

import MemberBlockPrompt, {
  resetPortalUrlCache,
} from "@/components/novel/license/MemberBlockPrompt";

function dispatchBlock(message?: string) {
  window.dispatchEvent(
    new CustomEvent("member-block", { detail: { message } }),
  );
}

beforeEach(() => {
  apiState.get.mockReset();
  resetPortalUrlCache();
});

describe("MemberBlockPrompt — AI 会员拦截统一升级引导", () => {
  it("无事件时不渲染", () => {
    render(<MemberBlockPrompt />);
    expect(screen.queryByTestId("member-block-prompt")).toBeNull();
  });

  it("member-block 事件弹出升级引导，含门户 CTA", async () => {
    apiState.get.mockResolvedValue({
      portal_url: "https://portal.example.com",
      has_api_key: true,
    });
    render(<MemberBlockPrompt />);
    dispatchBlock("AI 是会员功能 — 开通 PRO 或 7 天免费试用后即可使用");
    expect(await screen.findByText(/开通 PRO 或 7 天免费试用/)).toBeDefined();
    const cta = await screen.findByText("去 S 端开通 / 续费");
    expect(cta.getAttribute("href")).toBe("https://portal.example.com");
  });

  it("无门户地址时降级为「知道了」按钮", async () => {
    apiState.get.mockResolvedValue({ portal_url: "", has_api_key: true });
    render(<MemberBlockPrompt />);
    dispatchBlock();
    expect(await screen.findByText("知道了")).toBeDefined();
    expect(screen.queryByText("去 S 端开通 / 续费")).toBeNull();
  });

  it("稍后再说关闭弹窗", async () => {
    apiState.get.mockRejectedValue(new Error("net"));
    render(<MemberBlockPrompt />);
    dispatchBlock();
    await waitFor(() =>
      expect(screen.getByTestId("member-block-prompt")).toBeDefined(),
    );
    fireEvent.click(screen.getByText("稍后再说"));
    await waitFor(() =>
      expect(screen.queryByTestId("member-block-prompt")).toBeNull(),
    );
  });
});
