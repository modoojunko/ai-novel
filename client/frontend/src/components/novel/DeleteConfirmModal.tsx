import { useState } from "react";
import Modal from "@/components/design/Modal";

interface DeleteConfirmModalProps {
  title: string;
  confirmText: string;   // 用户需要敲的字
  description?: string;  // 覆盖默认删除说明（默认面向删除小说）
  onConfirm: () => void;
  onCancel: () => void;
}

/** 删除确认（设计 .mcard 容器语言；确认按钮 btn-danger） */
export default function DeleteConfirmModal({ title, confirmText, description, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const [input, setInput] = useState("");
  const canDelete = input === confirmText;

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={`删除${title}`}
      width={380}
      footer={
        <>
          <button onClick={onCancel} className="btn btn-secondary">
            取消
          </button>
          <button onClick={onConfirm} disabled={!canDelete} className="btn btn-danger">
            确认删除
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7, margin: "0 0 10px" }}>
        {description ?? "此操作不可撤销。所有卷、章节和设定将被永久删除。"}
      </p>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 10px" }}>
        请输入 <b style={{ color: "var(--fg)", fontWeight: 500 }}>{confirmText}</b> 确认删除：
      </p>
      <div className="field" style={{ marginBottom: 4 }}>
        <input
          type="text"
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={confirmText}
          onKeyDown={(e) => e.key === "Enter" && canDelete && onConfirm()}
          autoFocus
          aria-label={`输入${confirmText}确认删除`}
        />
      </div>
    </Modal>
  );
}
