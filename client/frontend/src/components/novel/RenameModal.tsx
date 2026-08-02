import { useState } from "react";
import { Loader2 } from "lucide-react";

interface RenameModalProps {
  /** 当前书名 */
  name: string;
  onConfirm: (next: string) => Promise<void> | void;
  onCancel: () => void;
}

/** 小号改名弹窗（与 DeleteConfirmModal 同容器语言，确认按钮用 btn-primary） */
export default function RenameModal({ name, onConfirm, onCancel }: RenameModalProps) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const trimmed = value.trim();
  const invalid = !trimmed || trimmed === name;

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
        <h3 className="text-lg font-bold font-serif text-base-content mb-2">
          重命名小说
        </h3>
        <input
          className="input input-bordered w-full text-sm mb-1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape" && !saving) onCancel();
          }}
          maxLength={60}
          disabled={saving}
          autoFocus
          aria-label="小说书名"
        />
        <p className="text-xs text-base-content/40 mb-4 text-right tabular-nums">
          {value.length}/60
        </p>
        <div className="flex justify-end gap-2">
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
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
