import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// useChapterData — 1.5s 防抖自动保存 / 保存四态（含重试）/ countChars / 卸载 flush
// ---------------------------------------------------------------------------

const apiState = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  fetchPhaseStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiState }));

const CHAPTER = {
  volume: 1,
  chapter: 1,
  title: "第一章",
  status: "outline",
  outline: { summary: "概要" },
  prose: "",
};

beforeEach(() => {
  apiState.get.mockReset();
  apiState.put.mockReset();
  apiState.post.mockReset();
  apiState.delete.mockReset();
  apiState.patch.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

async function importHooks() {
  return await import("@/hooks/useChapterData");
}

async function mountHook(projectId = "p1", ref = "vol-1-ch-1") {
  const { useChapterData } = await importHooks();
  const utils = renderHook(() => useChapterData(projectId, ref));
  await act(async () => {}); // flush 初始 load
  return utils;
}

describe("countChars", () => {
  it("去空白中文字符数（B5 同口径）", async () => {
    const { countChars } = await importHooks();
    expect(countChars("")).toBe(0);
    expect(countChars("你好 世界")).toBe(4);
    expect(countChars("你\n好\t世 界")).toBe(4);
    expect(countChars("Hello World")).toBe(10);
  });
});

describe("载入与字数", () => {
  it("载入章节，字数按去空白统计，初始 saved 态", async () => {
    apiState.get.mockResolvedValue({ ...CHAPTER, prose: "你好 世界" });
    const { result } = await mountHook();
    expect(result.current.loading).toBe(false);
    expect(result.current.prose).toBe("你好 世界");
    expect(result.current.summary).toBe("概要");
    expect(result.current.wordCount).toBe(4);
    expect(result.current.saveState).toBe("saved");
    expect(result.current.isDirty).toBe(false);
  });

  it("加载失败置 error，不抛", async () => {
    apiState.get.mockRejectedValue(new Error("章节不存在"));
    const { result } = await mountHook();
    expect(result.current.error).toBe("章节不存在");
    expect(result.current.loading).toBe(false);
  });
});

describe("自动保存（1.5s 防抖）", () => {
  it("编辑置 unsaved；防抖窗口内不保存；1500ms 后经 /prose 端点保存回 saved", async () => {
    vi.useFakeTimers();
    apiState.get.mockResolvedValue({ ...CHAPTER });
    apiState.put.mockResolvedValue({});
    const { result } = await mountHook();

    act(() => result.current.setProse("你好世界"));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.saveState).toBe("unsaved");

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(apiState.put).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {});
    expect(apiState.put).toHaveBeenCalledTimes(1);
    expect(apiState.put).toHaveBeenCalledWith(
      "/novels/p1/chapters/vol-1-ch-1/prose",
      { prose: "你好世界" },
    );
    expect(result.current.saveState).toBe("saved");
    expect(result.current.isDirty).toBe(false);
  });

  it("保存期间进 autosaving 态", async () => {
    vi.useFakeTimers();
    apiState.get.mockResolvedValue({ ...CHAPTER });
    let resolvePut!: (v: unknown) => void;
    apiState.put.mockImplementation(
      () => new Promise((res) => (resolvePut = res)),
    );
    const { result } = await mountHook();

    act(() => result.current.setProse("你好世界"));
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    // PUT 挂起中 → autosaving
    expect(result.current.saveState).toBe("autosaving");

    await act(async () => {
      resolvePut({});
    });
    expect(result.current.saveState).toBe("saved");
  });

  it("保存端点降级：/prose 失败 → 全量 PUT /chapters/{ref}", async () => {
    vi.useFakeTimers();
    apiState.get.mockResolvedValue({ ...CHAPTER });
    apiState.put.mockRejectedValueOnce(new Error("404"));
    apiState.put.mockResolvedValueOnce({});
    const { result } = await mountHook();

    act(() => result.current.setProse("降级保存"));
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {});
    expect(apiState.put).toHaveBeenCalledTimes(2);
    expect(apiState.put).toHaveBeenNthCalledWith(
      1,
      "/novels/p1/chapters/vol-1-ch-1/prose",
      { prose: "降级保存" },
    );
    expect(apiState.put).toHaveBeenNthCalledWith(
      2,
      "/novels/p1/chapters/vol-1-ch-1",
      expect.objectContaining({ prose: "降级保存", outline: { summary: "概要" } }),
    );
    expect(result.current.saveState).toBe("saved");
  });
});

describe("失败与重试", () => {
  it("主端点与降级端点均失败 → failed 态 + error；retry 成功回 saved", async () => {
    vi.useFakeTimers();
    apiState.get.mockResolvedValue({ ...CHAPTER });
    // /prose 失败 → 降级 /chapters 也失败 → failed
    apiState.put.mockRejectedValueOnce(new Error("网络错误"));
    apiState.put.mockRejectedValueOnce(new Error("网络错误"));
    const { result } = await mountHook();

    act(() => result.current.setProse("新增内容"));
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {});
    expect(result.current.saveState).toBe("failed");
    expect(result.current.error).toBe("网络错误");

    apiState.put.mockReset();
    apiState.put.mockResolvedValue({});
    act(() => result.current.retry());
    await act(async () => {});
    expect(result.current.saveState).toBe("saved");
  });
});

describe("卸载 / 切章 flush", () => {
  it("卸载时 flush 未保存内容（不丢失防抖窗口内输入）", async () => {
    vi.useFakeTimers();
    apiState.get.mockResolvedValue({ ...CHAPTER });
    apiState.put.mockResolvedValue({});
    const { result, unmount } = await mountHook();

    act(() => result.current.setProse("未保存内容"));
    act(() => unmount());
    await act(async () => {});
    expect(apiState.put).toHaveBeenCalledWith(
      "/novels/p1/chapters/vol-1-ch-1/prose",
      { prose: "未保存内容" },
    );
  });
});

describe("目标字数与归档", () => {
  it("目标字数持久化到 localStorage 并实时更新进度口径", async () => {
    apiState.get.mockResolvedValue({ ...CHAPTER });
    const { result } = await mountHook();
    expect(result.current.targetWords).toBe(2000);

    act(() => result.current.setTargetWords(5000));
    expect(result.current.targetWords).toBe(5000);
    expect(localStorage.getItem("target-words-p1-vol-1-ch-1")).toBe("5000");
  });

  it("归档：非空正文 POST archive → status 置 archived + saved", async () => {
    apiState.get.mockResolvedValue({ ...CHAPTER });
    apiState.post.mockResolvedValue({});
    const { result } = await mountHook();

    act(() => result.current.setProse("正文内容"));
    await act(async () => {
      await result.current.archive();
    });
    expect(apiState.post).toHaveBeenCalledWith(
      "/novels/p1/chapters/vol-1-ch-1/archive",
      { full_text: "正文内容" },
    );
    expect(result.current.status).toBe("archived");
    expect(result.current.saveState).toBe("saved");
  });

  it("归档成功 dispatch chapter:archived 事件（树 📦 同步）", async () => {
    apiState.get.mockResolvedValue({ ...CHAPTER });
    apiState.post.mockResolvedValue({});
    const received: Array<{ projectId: string; ref: string }> = [];
    const listener = (e: Event) =>
      received.push((e as CustomEvent).detail as { projectId: string; ref: string });
    window.addEventListener("chapter:archived", listener);
    const { result } = await mountHook();

    act(() => result.current.setProse("正文内容"));
    await act(async () => {
      await result.current.archive();
    });
    window.removeEventListener("chapter:archived", listener);
    expect(received).toEqual([{ projectId: "p1", ref: "vol-1-ch-1" }]);
  });
});
