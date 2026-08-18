import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// useOnboarding — isNew 判定守卫：readiness 拉取失败（null）时
// 不能当作「全新项目」，避免把已有数据的项目误拉回设定引导。
// 数据源 = GET /novels/{id}/readiness（内容就绪判定）。
// ---------------------------------------------------------------------------

const apiState = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const toastState = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiState }));
vi.mock("@/lib/toast", () => ({ toast: toastState }));

const READINESS_KEYS = ["synopsis", "genre", "world", "style", "anti-ai", "hooks", "characters"];

const EMPTY_READINESS = {
  complete: false,
  missing: READINESS_KEYS.map((k) => ({ key: k, label: k, jump: k })),
  warning: "还差 7 项设定",
};

const COMPLETE_READINESS = {
  complete: true,
  missing: [],
  warning: "",
};

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
  it("readiness 拉取失败（null）+ 无卷 → isNew=false（守卫生效）", async () => {
    apiState.get.mockRejectedValue(new Error("S端离线"));
    const { result } = await mountHook();
    expect(result.current.settingsStatus).toBeNull();
    expect(result.current.isNew).toBe(false);
  });

  it("正常全新项目（七项未完成 + 无卷）→ isNew=true", async () => {
    apiState.get.mockResolvedValue({ ...EMPTY_READINESS });
    const { result } = await mountHook();
    expect(result.current.isNew).toBe(true);
  });

  it("已有卷 → isNew=false（即使设定未完成）", async () => {
    apiState.get.mockResolvedValue({ ...EMPTY_READINESS });
    const { result } = await mountHook("p1", [{ ref: "vol-1" }]);
    expect(result.current.isNew).toBe(false);
  });

  it("七项设定全部完成 → isNew=false", async () => {
    apiState.get.mockResolvedValue({ ...COMPLETE_READINESS });
    const { result } = await mountHook();
    expect(result.current.isNew).toBe(false);
  });

  it("readiness 派生：缺 2 项时对应面板 confirmed=false，ai-model 恒绿", async () => {
    apiState.get.mockResolvedValue({
      complete: false,
      missing: [
        { key: "world", label: "世界设定", jump: "world" },
        { key: "hooks", label: "伏笔管理", jump: "hooks" },
      ],
      warning: "还差 2 项设定",
    });
    const { result } = await mountHook();
    expect(result.current.settingsStatus).toMatchObject({
      world: false,
      hooks: false,
      synopsis: true,
      genre: true,
      "ai-model": true,
    });
  });
});

describe("confirmSetting 失败", () => {
  it("后端判定内容为空返回 400 → toast.error 且返回 false，不抛", async () => {
    apiState.get.mockResolvedValue({ ...EMPTY_READINESS });
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
