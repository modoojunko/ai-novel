import { useState } from "react";
import Modal from "@/components/design/Modal";

interface RenameModalProps {
  /** 当前书名 */
  name: string;
  onConfirm: (next: string) => Promise<void> | void;
  onCancel: () => void;
}

/** 改名弹窗（设计 .mcard 容器语言） */
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
    <Modal
      open={true}
      onClose={onCancel}
      locked={saving}
      title="重命名小说"
      width={380}
      footer={
        <>
          <button onClick={onCancel} className="btn btn-secondary" disabled={saving}>
            取消
          </button>
          <button onClick={() => void submit()} disabled={invalid || saving} className="btn btn-primary">
            {saving ? "保存中…" : "保存"}
          </button>
        </>
      }
    >
      <div className="field" style={{ marginBottom: 4 }}>
        <label htmlFor="rename-input">书名</label>
        <input
          id="rename-input"
          autoFocus
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          maxLength={60}
          disabled={saving}
        />
      </div>
    </Modal>
  );
}
