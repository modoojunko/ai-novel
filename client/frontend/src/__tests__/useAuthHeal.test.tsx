import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const requestMock = vi.fn();
const setTokenMock = vi.fn();

beforeEach(() => {
  requestMock.mockReset();
  setTokenMock.mockReset();
  localStorage.clear();
  vi.resetModules();
  vi.doMock("@/lib/api", () => ({ request: requestMock }));
  vi.doMock("@/lib/auth", () => ({ setToken: setTokenMock }));
});

async function mountHeal() {
  const { useAuthHeal } = await import("@/hooks/useAuthHeal");
  return renderHook(() => useAuthHeal());
}

describe("useAuthHeal", () => {
  it("后端会话有效时写回 localStorage token/username", async () => {
    requestMock.mockResolvedValue({
      code: 0,
      data: { token: "healed-token", username: "modoojunko" },
    });
    await mountHeal();
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith("/auth/check-auth"));

    expect(setTokenMock).toHaveBeenCalledWith("healed-token", "modoojunko");
  });

  it("未登录（code!==0）不清除/不覆盖现有 localStorage", async () => {
    localStorage.setItem("auth_token", "existing-token");
    requestMock.mockResolvedValue({ code: 1, data: { message: "未登录" } });
    await mountHeal();
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());

    expect(setTokenMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBe("existing-token");
  });

  it("dev-token 不写回（开发占位）", async () => {
    localStorage.setItem("auth_token", "existing-token");
    requestMock.mockResolvedValue({
      code: 0,
      data: { token: "dev-token", username: "dev" },
    });
    await mountHeal();
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());

    expect(setTokenMock).not.toHaveBeenCalled();
  });

  it("网络失败静默：不抛错、不修改 localStorage", async () => {
    localStorage.setItem("auth_token", "existing-token");
    requestMock.mockRejectedValue(new Error("network down"));
    await mountHeal();
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());

    expect(setTokenMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBe("existing-token");
  });
});
