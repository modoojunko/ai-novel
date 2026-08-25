import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// StoryArcForm — 主线卡表单（settings-three-col 后向导已拆至右栏 ArcWizard）
// - 挂载拉卡回显；保存走 PUT（整存整取）
// - 基调：问句+带解释选择题；选/再点取消；「自己写」填空；旧数据「待定」按未选
// - 分卷行：加行/待定/删除
// ---------------------------------------------------------------------------

const apiState = vi.hoisted(() => ({
  fetchStoryArc: vi.fn(),
  updateStoryArc: vi.fn(),
}));
const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiState }));
vi.mock("@/lib/toast", () => ({ toast: toastState }));

import StoryArcForm from "@/components/novel/settings/StoryArcForm";

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

async function actasync(fn: () => Promise<void>) {
  const { act } = await import("@testing-library/react");
  await act(fn);
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
    expect(screen.getByRole("radio", { name: /^悲/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("基调：选择题选上 → 再点取消 → 保存写对应值/空", async () => {
    const { ref } = await mount();
    const bei = screen.getByRole("radio", { name: /^悲/ });
    expect(bei.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(bei);
    expect(bei.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(bei); // 再点已选项 = 取消
    expect(bei.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(bei);
    let ok = false;
    await actasync(async () => {
      ok = await ref.current.save();
    });
    expect(ok).toBe(true);
    expect(apiState.updateStoryArc).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ ending: expect.objectContaining({ tone: "悲" }) }),
    );
  });

  it("基调「自己写」：填空写入自定义文本；清空=未选；切回预设清自定义", async () => {
    const { ref } = await mount();
    const custom = screen.getByPlaceholderText(/先悲后喜/) as HTMLInputElement;
    fireEvent.change(custom, { target: { value: "先悲后喜" } });
    expect(screen.getByRole("radio", { name: /自己写/ }).getAttribute("aria-checked")).toBe("true");
    // 切回预设：自定义文本被清除
    fireEvent.click(screen.getByRole("radio", { name: /^喜/ }));
    expect(custom.value).toBe("");
    fireEvent.change(custom, { target: { value: "团圆但留遗憾" } });
    // 清空填空 = 未选
    fireEvent.change(custom, { target: { value: "" } });
    let ok = false;
    await actasync(async () => {
      ok = await ref.current.save();
    });
    expect(ok).toBe(true);
    expect(apiState.updateStoryArc).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ ending: expect.objectContaining({ tone: "" }) }),
    );
  });

  it("基调旧数据「待定」：按未选显示，保存清成空", async () => {
    apiState.fetchStoryArc.mockResolvedValue({
      premise: "p",
      ending: { scene: "", hero: "", tone: "待定" },
      volumes: [],
      next_step: 2,
      has_content: true,
    });
    const { ref } = await mount();
    for (const r of screen.getAllByRole("radio")) {
      expect(r.getAttribute("aria-checked")).toBe("false");
    }
    let ok = false;
    await actasync(async () => {
      ok = await ref.current.save();
    });
    expect(ok).toBe(true);
    expect(apiState.updateStoryArc).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ ending: expect.objectContaining({ tone: "" }) }),
    );
  });

  it("分卷行：加行 → 待定 → 删除", async () => {
    await mount();
    fireEvent.click(screen.getByText("加一卷"));
    expect(screen.getByPlaceholderText("卷名")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "待定" }));
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
