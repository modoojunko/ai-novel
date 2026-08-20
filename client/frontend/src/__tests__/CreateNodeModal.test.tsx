import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CreateNodeModal from "@/components/novel/CreateNodeModal";

// ---------------------------------------------------------------------------
// TE-31 — CreateNodeModal：序号只读 + 名称必填（名称即标题）
// ---------------------------------------------------------------------------

function renderModal(overrides: Partial<Parameters<typeof CreateNodeModal>[0]> = {}) {
  const props = {
    header: "新建卷",
    lockedLabel: "第三卷",
    inputLabel: "卷名",
    placeholder: "如：风起晋北",
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<CreateNodeModal {...props} />);
  return props;
}

describe("CreateNodeModal", () => {
  it("序号只读展示，不出现序号输入框", () => {
    renderModal();
    expect(screen.getByText("第三卷")).toBeDefined();
    expect(screen.getByLabelText("卷名")).toBeDefined();
  });

  it("名称为空时创建禁用；输入后可创建并回传 trim 后的名称", () => {
    const p = renderModal();
    const create = screen.getByRole("button", { name: "创建" });
    expect(create.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("卷名"), { target: { value: "  风起晋北  " } });
    expect(create.hasAttribute("disabled")).toBe(false);
    fireEvent.click(create);
    expect(p.onConfirm).toHaveBeenCalledWith("风起晋北");
  });

  it("Enter 提交、Esc 取消", async () => {
    const p = renderModal();
    const input = screen.getByLabelText("卷名");
    fireEvent.change(input, { target: { value: "风起晋北" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(p.onConfirm).toHaveBeenCalledTimes(1);

    // 等提交锁释放后再 Esc（提交中不响应取消）
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "创建" }).hasAttribute("disabled")).toBe(
        false,
      ),
    );
    fireEvent.keyDown(input, { key: "Escape" });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });

  it("提交中锁闭：按钮禁用且遮罩不触发取消", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const p = renderModal({ onConfirm: vi.fn(() => gate) });

    fireEvent.change(screen.getByLabelText("卷名"), { target: { value: "风起晋北" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(p.onConfirm).toHaveBeenCalledTimes(1);

    const create = screen.getByRole("button", { name: "创建" });
    expect(create.hasAttribute("disabled")).toBe(true);
    // 遮罩点击（弹窗容器最外层）
    fireEvent.click(screen.getByText("新建卷").closest(".fixed")!);
    expect(p.onCancel).not.toHaveBeenCalled();

    release();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "创建" }).hasAttribute("disabled")).toBe(
        false,
      ),
    );
  });
});
