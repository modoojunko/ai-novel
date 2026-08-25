import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// ArcWizard — AI 拆主线四步向导（settings-three-col 起挂设定视图右栏）
// - 免费 403：不落卡（全局升级弹窗由 request 广播）
// - 会员第 1 步：浓缩落卡（applyWizard）+ 进第 2 步
// - 挂载按 resumeStep 续步
// - 第 4 步自查结果渲染三问与结构归纳
// ---------------------------------------------------------------------------

const apiState = vi.hoisted(() => ({
  runArcWizard: vi.fn(),
}));
const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiState }));
vi.mock("@/lib/toast", () => ({ toast: toastState }));

import ArcWizard from "@/components/novel/settings/ArcWizard";
import { EMPTY_ARC, type ArcCtl } from "@/components/novel/settings/useStoryArc";

function makeCtl(overrides: Partial<ArcCtl> = {}): ArcCtl {
  return {
    projectId: "p1",
    arc: EMPTY_ARC,
    loading: false,
    saving: false,
    resumeStep: 1,
    patch: vi.fn(),
    save: vi.fn(async () => true),
    applyWizard: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AI 拆主线向导（右栏）", () => {
  it("免费 403：不落卡（全局升级弹窗由 request 广播）", async () => {
    const ctl = makeCtl();
    render(<ArcWizard ctl={ctl} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "我想写……" } });
    const err = Object.assign(new Error("AI 是会员功能"), {
      reason: "member_required",
      status: 403,
    });
    apiState.runArcWizard.mockRejectedValue(err);
    fireEvent.click(screen.getByText("让 AI 处理并进下一步"));
    await waitFor(() => expect(apiState.runArcWizard).toHaveBeenCalled());
    await waitFor(() => expect(ctl.applyWizard).not.toHaveBeenCalled());
  });

  it("会员第 1 步：浓缩落卡 + 进第 2 步", async () => {
    const ctl = makeCtl();
    render(<ArcWizard ctl={ctl} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "陆征是私家侦探……" } });
    apiState.runArcWizard.mockResolvedValue({
      value: { premise: "一句话主线", notes: "抓住了查案主线" },
    });
    fireEvent.click(screen.getByText("让 AI 处理并进下一步"));
    await waitFor(() =>
      expect(ctl.applyWizard).toHaveBeenCalledWith(
        expect.objectContaining({ premise: "一句话主线" }),
        2,
      ),
    );
    await waitFor(() => expect(screen.getByText("2. 聊结局").className).toContain("on"));
  });

  it("挂载按 resumeStep 续步", () => {
    const ctl = makeCtl({ resumeStep: 3 });
    render(<ArcWizard ctl={ctl} />);
    expect(screen.getByText("3. 倒推分卷").className).toContain("on");
  });

  it("第 4 步自查结果渲染三问与结构归纳", async () => {
    const ctl = makeCtl({ resumeStep: 4 });
    render(<ArcWizard ctl={ctl} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "自查" } });
    apiState.runArcWizard.mockResolvedValue({
      value: {
        checks: [{ question: "每卷挂在主线上", passed: true, detail: "均挂主线" }],
        passed: true,
        structure: "三卷式：起/承/转合",
      },
    });
    fireEvent.click(screen.getByText("开始自查"));
    await waitFor(() => expect(screen.getByText(/三卷式/)).toBeTruthy());
    expect(screen.getByText(/均挂主线/)).toBeTruthy();
  });
});
