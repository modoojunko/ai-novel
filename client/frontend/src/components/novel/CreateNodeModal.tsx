import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface CreateNodeModalProps {
  /** 弹窗标题：新建卷 / 新建章 */
  header: string;
  /** 程序排定的序号（只读展示）：第三卷 / 第一卷 · 第3章 */
  lockedLabel: string;
  /** 名称输入框标签：卷名 / 章名 */
  inputLabel: string;
  placeholder: string;
  /** 名称必填：为空禁用创建。默认 200 与后端对齐。 */
  maxLength?: number;
  onConfirm: (name: string) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * 新建卷/章通用弹窗：序号程序排定（只读）+ 名称必填（名称即标题）。
 * 容器语言与 RenameModal 一致；Enter 确认、Esc/遮罩取消、提交中锁闭。
 */
export default function CreateNodeModal({
  header,
  lockedLabel,
  inputLabel,
  placeholder,
  maxLength = 200,
  onConfirm,
  onCancel,
}: CreateNodeModalProps) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = value.trim();
  const invalid = !trimmed;

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  async function submit() {
    if (invalid || saving) return;
    setSaving(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={saving ? undefined : onCancel}
    >
      <div
        className="bg-base-100 border border-base-300 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold font-serif text-base-content mb-4">
          {header}
        </h3>

        {/* 序号：程序排定，只读 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-base-content/50 shrink-0">序号</span>
          <span className="badge badge-ghost font-medium text-base-content/70">
            {lockedLabel}
          </span>
          <span className="text-xs text-base-content/40">自动排定</span>
        </div>

        {/* 名称：必填，即本卷/本章标题 */}
        <label className="text-xs font-medium text-base-content/60 mb-1 block">
          {inputLabel}
        </label>
        <input
          ref={inputRef}
          className="input input-bordered w-full text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape" && !saving) onCancel();
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={saving}
          aria-label={inputLabel}
        />
        <p className="text-xs text-base-content/40 mt-1.5 flex justify-between">
          <span>{inputLabel}必填</span>
          <span className="tabular-nums">
            {value.length}/{maxLength}
          </span>
        </p>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="btn btn-ghost btn-sm text-base-content/60"
            disabled={saving}
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={invalid || saving}
            className="btn btn-primary btn-sm"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
