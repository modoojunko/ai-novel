import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import NovelWorkspace from "@/components/novel/NovelWorkspace";
import {
  ProjectContext,
  type ProjectState,
} from "@/components/novel/license/ProjectShell";
import {
  TierContext,
  type TierState,
} from "@/components/novel/license/LicenseProvider";

// ---------------------------------------------------------------------------
// TE-16 — NovelWorkspace 四态视图机：
//   默认落点 workbench；免费态零 phase-status 请求；advanced 懒挂载/离开卸载；
//   workbench 常驻挂载（切视图不丢 prose 输入）
// ---------------------------------------------------------------------------

const apiState = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  fetchPhaseStatus: vi.fn(),
  fetchStory: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiState }));

function TierProvider({ tier, children }: { tier: string; children: ReactNode }) {
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

function ProjectProvider({ children }: { children: ReactNode }) {
  const value: ProjectState = {
    project: { id: "p1", name: "测试小说", source: "manual", type: "" },
    loading: false,
    error: null,
    updateProject: vi.fn(),
  };
  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

/** 空卷树：workbench 呈现 EmptyState。 */
function mockEmptyTree() {
  apiState.get.mockImplementation((path: string) => {
    if (path === "/novels/p1/volumes") return Promise.resolve([]);
    if (path === "/novels/p1/settings/status") return Promise.resolve({});
    return Promise.resolve({});
  });
  apiState.fetchStory.mockResolvedValue({ synopsis: "" });
}

/** 一卷一章：可展开树 → 选章 → 编辑器。 */
function mockOneChapterTree() {
  apiState.get.mockImplementation((path: string) => {
    if (path === "/novels/p1/volumes")
      return Promise.resolve([
        {
          ref: "vol-1",
          title: "第一卷",
          summary: "",
          chapter_count: 1,
          chapters: [
            {
              ref: "vol-1-ch-1",
              volume: 1,
              chapter: 1,
              title: "第一章",
              status: "outline",
              word_count: 0,
              has_prose: false,
              outline_status: "unfilled",
              archived: false,
            },
          ],
        },
      ]);
    if (path === "/novels/p1/chapters/vol-1-ch-1")
      return Promise.resolve({
        volume: 1,
        chapter: 1,
        title: "第一章",
        status: "outline",
        outline: { summary: "" },
        prose: "",
      });
    if (path === "/novels/p1/settings/status") return Promise.resolve({});
    return Promise.resolve({});
  });
  apiState.fetchStory.mockResolvedValue({ synopsis: "" });
  apiState.put.mockResolvedValue({});
  apiState.post.mockResolvedValue({});
}

function renderWorkspace(tier = "none") {
  return render(
    <MemoryRouter initialEntries={["/novel/p1"]}>
      <TierProvider tier={tier}>
        <ProjectProvider>
          <Routes>
            <Route path="/novel/:id" element={<NovelWorkspace />} />
          </Routes>
        </ProjectProvider>
      </TierProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiState.get.mockReset();
  apiState.post.mockReset();
  apiState.put.mockReset();
  apiState.patch.mockReset();
  apiState.delete.mockReset();
  apiState.fetchStory.mockReset();
  localStorage.clear();
});

describe("默认落点 workbench（免费）", () => {
  it("渲染后即呈现写作工作台，无阶段催促 UI", async () => {
    mockEmptyTree();
    renderWorkspace("none");
    // workbench EmptyState 可见
    expect(await screen.findByText("开始写你的第一部小说")).toBeVisible();
    // 顶栏书名 + 高级配置入口（书名同时出现在顶栏与面包屑，取≥1）
    expect(screen.getAllByText("测试小说").length).toBeGreaterThan(0);
    expect(screen.getByTitle("高级配置（设定/大纲）")).toBeDefined();
    // 免费态零 phase-status 请求
    expect(apiState.get).not.toHaveBeenCalledWith(
      "/novels/p1/workflow/phase-status",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("免费态：无阶段催促 UI、无 AI 字段入口", () => {
  it("免费态不渲染 GateBanner/OnboardingCard/TABS", async () => {
    mockEmptyTree();
    renderWorkspace("none");
    await screen.findByText("开始写你的第一部小说");
    expect(screen.queryByText(/尚未完成设定/)).toBeNull();
    // 无 PRO 阶段 tab（「正文」仅存在于 TabProgressButton，NovelBar 下拉只有设定/大纲/归档）
    expect(screen.queryByRole("button", { name: "正文" })).toBeNull();
    expect(apiState.get).not.toHaveBeenCalledWith(
      "/novels/p1/workflow/phase-status",
    );
  });
});

describe("advanced-settings 懒挂载 / 离开卸载", () => {
  it("经「高级配置 ▾ → 设定」进入设定视图，返回正文后卸载", async () => {
    mockEmptyTree();
    renderWorkspace("none");
    await screen.findByText("开始写你的第一部小说");

    // 打开高级配置 → 设定
    fireEvent.click(screen.getByRole("button", { name: "设定" }));
    // 设定视图挂载（返回按钮 + 设定树）
    expect(screen.getByRole("button", { name: "返回正文" })).toBeDefined();
    await waitFor(() =>
      expect(screen.getAllByText("世界设定").length).toBeGreaterThan(0),
    );
    // workbench 被 hidden 隐藏而非卸载（EmptyState 仍在 DOM 但不可见）
    expect(screen.getByText("开始写你的第一部小说")).not.toBeVisible();

    // 返回正文 → 设定视图卸载
    fireEvent.click(screen.getByRole("button", { name: "返回正文" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "返回正文" })).toBeNull(),
    );
    expect(screen.getByText("开始写你的第一部小说")).toBeVisible();
  });
});

describe("workbench 常驻挂载：切视图 prose 不丢", () => {
  it("选中章输入后切到设定再返回，正文内容保留", async () => {
    mockOneChapterTree();
    renderWorkspace("none");
    await screen.findByText("第一卷");

    // 展开卷 → 点击第一章 → 编辑器
    fireEvent.click(screen.getByText("▸"));
    fireEvent.click(screen.getByText("第一章"));
    const textarea = await screen.findByPlaceholderText("正文（在此撰写小说内容）");
    fireEvent.change(textarea, { target: { value: "我在专注写作" } });
    expect(screen.getByDisplayValue("我在专注写作")).toBeDefined();

    // 切到设定 → 返回正文
    fireEvent.click(screen.getByRole("button", { name: "设定" }));
    await waitFor(() =>
      expect(screen.getAllByText("世界设定").length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getByRole("button", { name: "返回正文" }));

    // prose 保留（workbench 未卸载）
    expect(await screen.findByDisplayValue("我在专注写作")).toBeDefined();
  });
});

describe("PRO 态：阶段催促 UI 渲染", () => {
  it("PRO 渲染阶段 tab 与 phase-status 请求", async () => {
    mockEmptyTree();
    apiState.get.mockImplementation((path: string) => {
      if (path === "/novels/p1/volumes") return Promise.resolve([]);
      if (path === "/novels/p1/workflow/phase-status")
        return Promise.resolve({
          phases: {
            settings: "pending",
            outline: "pending",
            prompt: "pending",
            write: "pending",
            archive: "pending",
          },
          warnings: [],
        });
      return Promise.resolve({});
    });
    renderWorkspace("monthly");
    expect(screen.getByRole("button", { name: "正文" })).toBeDefined();
    await waitFor(() =>
      expect(apiState.get).toHaveBeenCalledWith(
        "/novels/p1/workflow/phase-status",
      ),
    );
  });
});
