import type { ApiConfig } from "../../types/api-config";

interface DeleteConfirmDialogProps {
  config: ApiConfig;
  affectedCount: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  deleting?: boolean;
}

export function DeleteConfirmDialog({
  config,
  affectedCount,
  onConfirm,
  onCancel,
  deleting,
}: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="modal-overlay fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="modal-dialog relative z-10 bg-base-100 rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold">确认删除</h3>
          <p className="text-sm text-base-content/70 mt-1">
            确定要删除「{config.name}」吗？此操作不可撤销。
          </p>
        </div>

        {affectedCount > 0 && (
          <div className="alert alert-warning text-sm mb-4">
            该配置当前被 <strong data-testid="affected-novels-count">{affectedCount}</strong>{" "}
            {affectedCount === 1 ? "部小说" : "部小说"}使用，删除后这些小说将无法使用 AI 功能。
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost" onClick={onCancel} disabled={deleting}>
            取消
          </button>
          <button
            className="btn btn-error"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting && <span className="loading loading-spinner" />}
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
