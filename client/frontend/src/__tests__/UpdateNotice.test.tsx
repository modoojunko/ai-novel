import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  vi.resetModules();
  vi.doMock("@/lib/api", () => ({
    api: { get: apiGetMock, post: apiPostMock },
  }));
});

function state(over: Partial<Record<string, unknown>> = {}) {
  return {
    current: "0.11",
    latest: "0.13",
    has_update: true,
    notes: "提升章纲 AI 起草的稳定性，修复若干问题",
    notes_url: "https://www.awesomenovel.com/download/v0.13/notes.html",
    download_url: "https://www.awesomenovel.com",
    ...over,
  };
}

async function mountAt(path: string) {
  const { default: UpdateNotice } = await import("@/components/UpdateNotice");
  return render(
    <MemoryRouter initialEntries={[path]}>
      <UpdateNotice />
    </MemoryRouter>,
  );
}

describe("UpdateNotice", () => {
  it("有更新：呈现版本号、摘要与三个动作；外链为 target=_blank 锚点", async () => {
    apiGetMock.mockResolvedValue(state());
    await mountAt("/novels");

    expect(await screen.findByText("发现新版本 v0.13")).toBeTruthy();
    expect(screen.getByText("提升章纲 AI 起草的稳定性，修复若干问题")).toBeTruthy();
    const download = screen.getByRole("link", { name: "去下载" }) as HTMLAnchorElement;
    const notes = screen.getByRole("link", { name: "查看更新内容" }) as HTMLAnchorElement;
    expect(download.href).toBe("https://www.awesomenovel.com/");
    expect(download.target).toBe("_blank");
    expect(download.rel).toContain("noopener");
    expect(notes.href).toBe(
      "https://www.awesomenovel.com/download/v0.13/notes.html",
    );
    expect(screen.getByRole("button", { name: "知道了" })).toBeTruthy();
  });

  it("无更新 / 检测失败：不渲染任何更新元素", async () => {
    apiGetMock.mockResolvedValue(state({ has_update: false, latest: "0.11" }));
    const { container } = await mountAt("/novels");
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(container.querySelector(".update-strip")).toBeNull();

    apiGetMock.mockRejectedValue(new Error("network down"));
    const again = await mountAt("/novels");
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(again.container.querySelector(".update-strip")).toBeNull();
  });

  it("「知道了」按版本关闭：调 dismiss 且提示条立即消失", async () => {
    apiGetMock.mockResolvedValue(state());
    apiPostMock.mockResolvedValue({ dismissed: "0.13" });
    const { container } = await mountAt("/novels");
    await screen.findByText("发现新版本 v0.13");

    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/update-check/dismiss", {
        version: "0.13",
      }),
    );
    expect(container.querySelector(".update-strip")).toBeNull();
  });

  it("工作台路由用沉浸全宽变体，书架用居中变体", async () => {
    apiGetMock.mockResolvedValue(state());
    const imm = await mountAt("/novel/abc");
    await waitFor(() => expect(imm.container.querySelector(".update-strip")).toBeTruthy());
    expect(imm.container.querySelector(".update-strip")!.className).toContain(
      "update-strip--imm",
    );

    const list = await mountAt("/config");
    await waitFor(() => expect(list.container.querySelector(".update-strip")).toBeTruthy());
    expect(list.container.querySelector(".update-strip")!.className).not.toContain(
      "update-strip--imm",
    );
  });
});
