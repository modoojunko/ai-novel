import { describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WritingTree from "@/components/novel/WritingTree";
import type { WorkbenchVolume } from "@/hooks/useWorkbench";
import type { TreeNode } from "@/components/novel/StructureTree";

// ---------------------------------------------------------------------------
// TE-28 — WritingTree：常驻「+新建卷/章」；空章「未写」弱化不硬过滤；
//   hover 重命名/删除/行内新建；字数/归档徽标
// ---------------------------------------------------------------------------

const volumes: WorkbenchVolume[] = [
  {
    name: "vol-1",
    title: "第一卷",
    chapters: [
      { chapter: 1, title: "第一章", word_count: 1200, status: "outline", has_prose: true },
      { chapter: 2, title: "第二章", word_count: 0, status: "outline", has_prose: false },
      { chapter: 3, title: "第三章", word_count: 500, status: "archived", archived: true },
    ],
  },
];

const expanded = new Set(["vol-1"]);

function renderTree(overrides: Partial<Parameters<typeof WritingTree>[0]> = {}) {
  const props = {
    volumes,
    selectedId: null,
    expandedIds: expanded,
    onToggle: vi.fn(),
    onSelectNode: vi.fn(),
    onCreateVolume: vi.fn(),
    onCreateChapter: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onAddChapterIn: vi.fn(),
    ...overrides,
  };
  render(<WritingTree {...props} />);
  return props;
}

describe("WritingTree 常驻新建动作", () => {
  it("顶部常驻「+ 新建卷」「+ 新建章」，点击触发回调", () => {
    const p = renderTree();
    expect(screen.getByTitle("新建卷")).toBeDefined();
    expect(screen.getByTitle("新建章")).toBeDefined();
    fireEvent.click(screen.getByTitle("新建卷"));
    expect(p.onCreateVolume).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTitle("新建章"));
    expect(p.onCreateChapter).toHaveBeenCalledTimes(1);
  });
});

describe("徽标（N1/N2）", () => {
  it("有正文章显示字数徽标", () => {
    renderTree();
    expect(screen.getByText("1200字")).toBeDefined();
  });

  it("空章显示「未写」弱化徽标（灰字），不硬过滤", () => {
    renderTree();
    const badge = screen.getByText("未写");
    expect(badge).toBeDefined();
    // 弱化色：var(--wa)（灰）
    expect(badge.style.color).toBe("var(--wa)");
  });

  it("归档章显示 📦 徽标", () => {
    renderTree();
    expect(screen.getByText("📦")).toBeDefined();
  });

  it("当前选中空章不再显示「未写」（选中态），但仍可见", () => {
    renderTree({ selectedId: "vol-1-ch-2" });
    expect(screen.queryByText("未写")).toBeNull();
    expect(screen.getByText("第二章")).toBeDefined();
  });
});

describe("树 CRUD 与选择", () => {
  it("点击章节节点 → onSelectNode 携 ref", () => {
    const p = renderTree();
    fireEvent.click(screen.getByText("第一章"));
    const node = (p.onSelectNode as Mock).mock.calls[0][0] as TreeNode;
    expect(node.id).toBe("vol-1-ch-1");
  });

  it("双击章节标题进入重命名（只编辑名称）→ 回车提交 onRename", () => {
    const p = renderTree();
    fireEvent.doubleClick(screen.getByText("第一章"));
    // 默认序号形态（第一章）= 没起过名：重命名输入框预填空，改名 = 起个名
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "城门初见" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(p.onRename).toHaveBeenCalledWith("vol-1-ch-1", "城门初见");
  });

  it("已有名称的节点：标签显示「序号 · 名称」，重命名预填只含名称", () => {
    const p = renderTree({
      volumes: [
        {
          name: "vol-1",
          title: "风起晋北",
          chapters: [],
        },
      ],
    });
    expect(screen.getByText("第一卷 · 风起晋北")).toBeDefined();
    fireEvent.doubleClick(screen.getByText("第一卷 · 风起晋北"));
    expect(screen.getByDisplayValue("风起晋北")).toBeDefined();
    const input = screen.getByDisplayValue("风起晋北");
    fireEvent.change(input, { target: { value: "风起云涌" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(p.onRename).toHaveBeenCalledWith("vol-1", "风起云涌");
  });

  it("hover 删除 → 行内确认「确认删除?」→ onDelete", () => {
    const p = renderTree();
    const deleteBtn = screen.getAllByTitle("删除")[0];
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByText("确认删除?"));
    expect(p.onDelete).toHaveBeenCalledWith("vol-1-ch-1");
  });

  it("卷节点 hover「+」行内新建 → onAddChapterIn(卷名)", () => {
    const p = renderTree();
    const addInBtn = screen.getByTitle("在卷下新建章节");
    fireEvent.click(addInBtn);
    expect(p.onAddChapterIn).toHaveBeenCalledWith("vol-1");
  });
});
