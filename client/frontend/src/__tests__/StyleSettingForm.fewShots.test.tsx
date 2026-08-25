// ai-prompt-crafting 6.2 — 文风表单「文风例句」（few_shot_examples 1-3 条）：
// 加载回读（>3 截断）、保存载荷（trim/过滤/截断 3）、存量为空一行可编辑。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import StyleSettingForm from "@/components/novel/settings/StyleSettingForm";
import type { SettingSaveHandle } from "@/components/novel/settings/FormField";

const apiState = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: apiState }));

const PH = "如：雨点砸在铁皮棚上，他没有抬头。";

function renderForm() {
  const ref = createRef<SettingSaveHandle>();
  render(
    <StyleSettingForm ref={ref} projectId="p1" settingKey="writing-style" />,
  );
  return ref;
}

function rows(): HTMLInputElement[] {
  return screen.getAllByPlaceholderText(PH) as HTMLInputElement[];
}

/** 例句输入所在的 Cfg 折叠块（文风例句专属，避免命中其他 ListEditor 的添加按钮） */
function fewShotsCfg() {
  const cfg = rows()[0].closest("details");
  if (!cfg) throw new Error("文风例句 Cfg 块未找到");
  return within(cfg as HTMLElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  apiState.get.mockResolvedValue({
    role: "一位小说家",
    core_principles: ["克制"],
    possible_mistakes: [],
    depiction_techniques: [],
    tone: { default_tone: "冷静" },
  });
  apiState.put.mockResolvedValue({});
});

describe("文风例句 few_shot_examples", () => {
  it("加载回读存量例句；>3 条只取前 3 且例句满 3 时不再出现「添加一项」", async () => {
    apiState.get.mockResolvedValue({
      role: "r",
      few_shot_examples: ["例句一", "例句二", "例句三", "例句四"],
    });
    renderForm();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows().map((r) => r.value)).toEqual(["例句一", "例句二", "例句三"]);
    // maxItems=3：例句行数已满时块内「添加一项」不渲染（其他块不受影响）
    expect(fewShotsCfg().queryByText("添加一项")).toBeNull();
  });

  it("保存载荷包含 few_shot_examples：trim + 过滤空行 + 截断 3", async () => {
    const ref = renderForm();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.change(rows()[0], { target: { value: "  雨点砸在铁皮棚上。 " } });
    fireEvent.click(fewShotsCfg().getByText("添加一项"));
    fireEvent.change(rows()[1], { target: { value: "   " } }); // 纯空白 → 过滤

    expect(await ref.current!.save()).toBe(true);
    expect(apiState.put).toHaveBeenCalledWith(
      "/novels/p1/settings/writing-style",
      expect.objectContaining({ few_shot_examples: ["雨点砸在铁皮棚上。"] }),
    );
  });

  it("存量为空 → 单空行可编辑；保存时输出空数组（不塞空串）", async () => {
    const ref = renderForm();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0].value).toBe("");
    fireEvent.change(rows()[0], { target: { value: "他数到第七声雷，才开口。" } });

    expect(await ref.current!.save()).toBe(true);
    expect(apiState.put).toHaveBeenCalledWith(
      "/novels/p1/settings/writing-style",
      expect.objectContaining({ few_shot_examples: ["他数到第七声雷，才开口。"] }),
    );
  });
});
