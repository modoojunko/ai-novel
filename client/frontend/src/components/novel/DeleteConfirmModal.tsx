import { useState } from "react";

interface DeleteConfirmModalProps {
  title: string;
  confirmText: string;   // 用户需要敲的字
  description?: string;  // 覆盖默认删除说明（默认面向删除小说）
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ title, confirmText, description, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const [input, setInput] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="bg-base-100 border border-base-300 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold font-serif text-base-content mb-2">删除{title}</h3>
        <p className="text-sm text-base-content/60 leading-relaxed mb-1">
          {description ?? "此操作不可撤销。所有卷、章节和设定将被永久删除。"}
        </p>
        <p className="text-sm text-base-content/60 mb-4">
          请输入 <strong className="text-base-content">{confirmText}</strong> 确认删除：
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={confirmText}
          className="input input-bordered w-full text-sm mb-4"
          onKeyDown={(e) => e.key === "Enter" && input === confirmText && onConfirm()}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-ghost btn-sm text-base-content/60">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={input !== confirmText}
            className="btn btn-error btn-sm disabled:opacity-40"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
