import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// useOnboarding — isNew 判定守卫：settings/status 拉取失败（null）时
// 不能当作「全新项目」，避免把已有数据的项目误拉回设定引导。
// ---------------------------------------------------------------------------

const apiState = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiState }));
vi.mock("@/lib/toast", () => ({ toast: toastState }));

const EMPTY_STATUS = {
  synopsis: false,
  genre: false,
  world: false,
  style: false,
  "anti-ai": false,
  hooks: false,
  characters: false,
};

const COMPLETE_STATUS = Object.fromEntries(
  Object.keys(EMPTY_STATUS).map((k) => [k, true]),
);

beforeEach(() => {
  apiState.get.mockReset();
  apiState.put.mockReset();
  toastState.error.mockReset();
});

async function mountHook(projectId = "p1", volumes: any[] = []) {
  const { useOnboarding } = await import("@/hooks/useOnboarding");
  const utils = renderHook(() => useOnboarding(projectId, volumes));
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
}

describe("isNew 判定", () => {
  it("settings/status 拉取失败（null）+ 无卷 → isNew=false（守卫生效）", async () => {
    apiState.get.mockRejectedValue(new Error("S端离线"));
    const { result } = await mountHook();
    expect(result.current.settingsStatus).toBeNull();
    expect(result.current.isNew).toBe(false);
  });

  it("正常全新项目（七项未完成 + 无卷）→ isNew=true", async () => {
    apiState.get.mockResolvedValue({ ...EMPTY_STATUS });
    const { result } = await mountHook();
    expect(result.current.isNew).toBe(true);
  });

  it("已有卷 → isNew=false（即使设定未完成）", async () => {
    apiState.get.mockResolvedValue({ ...EMPTY_STATUS });
    const { result } = await mountHook("p1", [{ ref: "vol-1" }]);
    expect(result.current.isNew).toBe(false);
  });

  it("七项设定全部完成 → isNew=false", async () => {
    apiState.get.mockResolvedValue({ ...COMPLETE_STATUS });
    const { result } = await mountHook();
    expect(result.current.isNew).toBe(false);
  });
});

describe("confirmSetting 失败", () => {
  it("后端判定内容为空返回 400 → toast.error 且返回 false，不抛", async () => {
    apiState.get.mockResolvedValue({ ...EMPTY_STATUS });
    apiState.put.mockRejectedValue(new Error("该项还未填写内容"));
    const { result } = await mountHook();

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.confirmSetting("synopsis");
    });
    expect(returned).toBe(false);
    expect(toastState.error).toHaveBeenCalledWith("该项还未填写内容");
  });
});
