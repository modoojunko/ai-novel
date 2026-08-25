import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// StoryArcForm — 主线卡（story-arc-planning）
// - 挂载拉卡回显；保存走 PUT（整存整取）
// - 分卷行：加行/待定/删除
// - 「AI 帮我拆」：免费 403 member_required 不改卡内容（全局升级弹窗由 request 广播）
// - 会员四步：产出落卡 + 每步自动保存；中途退出重开按 next_step 续步
// ---------------------------------------------------------------------------

const apiState = vi.hoisted(() => ({
  fetchStoryArc: vi.fn(),
  updateStoryArc: vi.fn(),
  runArcWizard: vi.fn(),
}));
const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiState }));
vi.mock("@/lib/toast", () => ({ toast: toastState }));

import StoryArcForm from "@/components/novel/settings/StoryArcForm";

/** 向导开着时，DOM 里最后一个 textbox 是向导输入框 */
function lastTextbox(): HTMLElement {
  const all = screen.getAllByRole("textbox");
  return all[all.length - 1];
}

const EMPTY = {
  premise: "",
  ending: { scene: "", hero: "", tone: "" },
  volumes: [],
  next_step: 1,
  has_content: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiState.fetchStoryArc.mockResolvedValue(EMPTY);
  apiState.updateStoryArc.mockResolvedValue({ ok: true, next_step: 1 });
});

async function mount() {
  const ref = { current: null as any };
  const utils = render(
    <StoryArcForm ref={ref as any} projectId="p1" />,
  );
  await waitFor(() => expect(screen.queryByText("加载主线卡…")).toBeNull());
  return { ...utils, ref };
}

describe("主线卡表单", () => {
  it("挂载拉卡回显", async () => {
    apiState.fetchStoryArc.mockResolvedValue({
      premise: "陆征追查失踪案",
      ending: { scene: "侦探所", hero: "", tone: "悲" },
      volumes: [{ title: "失踪", conflict: "发现旧案被压", chapters: "10" }],
      next_step: 4,
      has_content: true,
    });
    await mount();
    const ta = screen.getByPlaceholderText(/陆征追查失踪案/) as HTMLTextAreaElement;
    expect(ta.value).toBe("陆征追查失踪案");
    expect((screen.getByPlaceholderText("最后一幕画面（例：侦探所里看着旧卷宗）") as HTMLInputElement).value).toBe("侦探所");
  });

  it("分卷行：加行 → 待定 → 删除", async () => {
    await mount();
    fireEvent.click(screen.getByText("加一卷"));
    expect(screen.getByPlaceholderText("卷名")).toBeTruthy();
    // 避开基调 seg 里的「待定」按钮：分卷行的待定按钮是 btn 类
    const rowTbd = screen
      .getAllByRole("button", { name: "待定" })
      .find((b) => b.className.includes("btn-secondary"))!;
    fireEvent.click(rowTbd);
    expect((screen.getByPlaceholderText("卷名") as HTMLInputElement).value).toBe("待定");
    fireEvent.click(screen.getByRole("button", { name: "删除卷1" }));
    expect(screen.queryByPlaceholderText("卷名")).toBeNull();
  });

  it("面板 save() 走 PUT 整卡保存", async () => {
    const { ref } = await mount();
    fireEvent.change(screen.getByPlaceholderText(/陆征追查失踪案/), {
      target: { value: "新主线" },
    });
    let ok = false;
    await actasync(async () => {
      ok = await ref.current.save();
    });
    expect(ok).toBe(true);
    expect(apiState.updateStoryArc).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ premise: "新主线" }),
    );
  });
});

async function actasync(fn: () => Promise<void>) {
  const { act } = await import("@testing-library/react");
  await act(fn);
}

describe("AI 向导", () => {
  it("免费 403：向导不落卡（全局升级弹窗由 request 广播）", async () => {
    const { container } = await mount();
    fireEvent.click(screen.getByText("AI 帮我拆"));
    fireEvent.change(lastTextbox(), { target: { value: "我想写……" } });
    const err = Object.assign(new Error("AI 是会员功能"), {
      reason: "member_required",
      status: 403,
    });
    apiState.runArcWizard.mockRejectedValue(err);
    fireEvent.click(screen.getByText("让 AI 处理并进下一步"));
    await waitFor(() => expect(apiState.runArcWizard).toHaveBeenCalled());
    await waitFor(() => expect(apiState.updateStoryArc).not.toHaveBeenCalled());
    // 向导仍开着（可继续手动填），卡内容未被改
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
  });

  it("会员第 1 步：浓缩落卡 + 自动保存 + 进第 2 步", async () => {
    await mount();
    fireEvent.click(screen.getByText("AI 帮我拆"));
    fireEvent.change(lastTextbox(), { target: { value: "陆征是私家侦探……" } });
    apiState.runArcWizard.mockResolvedValue({
      value: { premise: "一句话主线", notes: "抓住了查案主线" },
    });
    apiState.updateStoryArc.mockResolvedValue({ ok: true, next_step: 2 });
    fireEvent.click(screen.getByText("让 AI 处理并进下一步"));
    await waitFor(() =>
      expect((screen.getByPlaceholderText(/陆征追查失踪案/) as HTMLTextAreaElement).value).toBe("一句话主线"),
    );
    expect(apiState.updateStoryArc).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ premise: "一句话主线" }),
    );
    // 步骤条进到第 2 步（聊结局）
    await waitFor(() => expect(screen.getByText("2. 聊结局").className).toContain("on"));
  });

  it("中途退出可续：重开按 next_step 回到未完成步骤", async () => {
    apiState.fetchStoryArc.mockResolvedValue({
      premise: "一句话主线",
      ending: { scene: "", hero: "", tone: "" },
      volumes: [],
      next_step: 2,
      has_content: true,
    });
    await mount();
    fireEvent.click(screen.getByText("AI 帮我拆"));
    // next_step=2 → 直接落在第 2 步
    expect(screen.getByText("2. 聊结局").className).toContain("on");
    // 收起再重开：仍在第 2 步
    fireEvent.click(screen.getByRole("button", { name: "收起向导" }));
    expect(screen.queryByText("2. 聊结局")).toBeNull();
    fireEvent.click(screen.getByText("AI 帮我拆"));
    expect(screen.getByText("2. 聊结局").className).toContain("on");
  });

  it("第 4 步自查结果渲染三问与结构归纳", async () => {
    apiState.fetchStoryArc.mockResolvedValue({
      premise: "p",
      ending: { scene: "", hero: "", tone: "悲" },
      volumes: [{ title: "初章", conflict: "起步", chapters: "8" }],
      next_step: 4,
      has_content: true,
    });
    await mount();
    fireEvent.click(screen.getByText("AI 帮我拆"));
    fireEvent.change(lastTextbox(), { target: { value: "自查" } });
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
