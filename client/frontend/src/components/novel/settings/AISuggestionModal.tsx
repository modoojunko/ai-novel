import { Sparkles, RefreshCw, Check, X } from "lucide-react";

interface AISuggestionModalProps {
  open: boolean;
  fieldLabel: string;
  content: string;
  loading: boolean;
  onAccept: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export default function AISuggestionModal({
  open, fieldLabel, content, loading, onAccept, onRetry, onClose,
}: AISuggestionModalProps) {
  if (!open) return null;

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base-content">AI 建议 · {fieldLabel}</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content area */}
        <div className="min-h-[120px] max-h-[300px] overflow-y-auto mb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <span className="loading loading-spinner loading-md text-primary" />
              <span className="text-sm text-base-content/50">AI 正在生成…</span>
            </div>
          ) : (
            <div className="bg-base-200/50 border border-base-300/60 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap text-base-content/80 font-serif">
              {content}
            </div>
          )}
        </div>

        {/* Actions */}
        {!loading && (
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onRetry}
              className="btn btn-ghost btn-sm gap-1.5 text-base-content/60"
            >
              <RefreshCw className="w-4 h-4" />
              换一个
            </button>
            <button
              onClick={onAccept}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <Check className="w-4 h-4" />
              接受这个
            </button>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
