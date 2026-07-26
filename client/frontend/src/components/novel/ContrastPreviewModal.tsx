import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ContrastPreviewModalProps {
  open: boolean;
  onClose: () => void;
  mode: "polish" | "expand";
  originalText: string;
  modifiedText: string | null;
  loading: boolean;
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
}

function SkeletonLines() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-5/6" />
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-4 w-4/5" />
      <div className="skeleton h-4 w-1/2" />
    </div>
  );
}

export default function ContrastPreviewModal({
  open,
  onClose,
  mode,
  originalText,
  modifiedText,
  loading,
  error,
  onAccept,
  onReject,
  onRetry,
}: ContrastPreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Control dialog open/close from prop
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  // Listen for native dialog close (Escape key, backdrop click)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => {
      // Only propagate if the dialog was open -- prevents loop when
      // the prop-driven close() call above fires this same event.
      if (open) onClose();
    };
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [open, onClose]);

  // Keyboard: Enter to accept (Escape is handled natively by <dialog>)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !loading && !error && modifiedText) {
        e.preventDefault();
        onAccept();
      }
    },
    [loading, error, modifiedText, onAccept]
  );

  const actionLabel = mode === "polish" ? "润色后" : "扩写后";

  const canAccept = !loading && !error && modifiedText !== null;

  return (
    <dialog ref={dialogRef} className="modal" onKeyDown={handleKeyDown}>
      <div className="modal-box max-w-4xl p-0 overflow-hidden">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
          <h3 className="text-lg font-semibold font-serif">
            {mode === "polish" ? "润色" : "扩写"}
          </h3>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Original text */}
            <div className="flex flex-col">
              <span className="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-2">
                原文
              </span>
              <div className="flex-1 p-4 rounded-lg border border-base-300 bg-base-100/50 min-h-[200px] max-h-[55vh] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap font-serif">
                {originalText || (
                  <span className="text-base-content/20">无内容</span>
                )}
              </div>
            </div>

            {/* Right: Modified / Loading / Error */}
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-xs font-medium uppercase tracking-wider mb-2",
                  "text-amber-600 dark:text-amber-400"
                )}
              >
                {actionLabel}
              </span>
              <div className="flex-1 p-4 rounded-lg border border-l-4 border-l-amber-400 border-base-300 bg-base-100/50 min-h-[200px] max-h-[55vh] overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-4 h-full">
                    <span className="loading loading-spinner loading-md text-amber-500" />
                    <SkeletonLines />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-full">
                    <p className="text-sm text-error text-center">{error}</p>
                    <button
                      onClick={onRetry}
                      className="btn btn-ghost btn-sm"
                    >
                      重试
                    </button>
                  </div>
                ) : modifiedText ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-serif">
                    {modifiedText}
                  </div>
                ) : (
                  <span className="text-base-content/20">待生成</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Action bar ──────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-base-300 bg-base-200/30">
          <button
            onClick={onReject}
            disabled={loading}
            className="btn btn-ghost btn-sm text-base-content/60"
          >
            拒绝
          </button>
          <button
            onClick={onRetry}
            disabled={loading}
            className="btn btn-ghost btn-sm"
          >
            换一个
          </button>
          <button
            onClick={onAccept}
            disabled={!canAccept}
            className="btn btn-primary btn-sm"
          >
            接受
          </button>
        </div>
      </div>

      {/* Backdrop — clicking outside closes dialog */}
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
