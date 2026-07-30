import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCw } from "lucide-react";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerspectiveModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  chapterRef: string;
  chapterSummary: string;
  existingGuidance?: string;
  onSaved: (guidance: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PerspectiveModal({
  open,
  onClose,
  projectId,
  chapterRef,
  chapterSummary,
  existingGuidance,
  onSaved,
}: PerspectiveModalProps) {
  const hasExisting = !!existingGuidance;
  const [guidance, setGuidance] = useState(existingGuidance || "");
  const [loading, setLoading] = useState(!hasExisting);
  const [error, setError] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  // -----------------------------------------------------------------------
  // API call
  // -----------------------------------------------------------------------

  const fetchPerspective = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGuidance("");
    try {
      const res: { guidance: string } = await api.post(
        `/novels/${projectId}/chapters/${chapterRef}/perspective`,
      );
      setGuidance(res.guidance);
    } catch (e: any) {
      setError(e.message || "视角转换失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, chapterRef]);

  // -----------------------------------------------------------------------
  // Auto-trigger on mount if no existing guidance
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      autoTriggered.current = false;
      return;
    }

    if (hasExisting) {
      setGuidance(existingGuidance!);
      setLoading(false);
      setError(null);
      return;
    }

    if (!autoTriggered.current) {
      autoTriggered.current = true;
      fetchPerspective();
    }
  }, [open, hasExisting, existingGuidance, fetchPerspective]);

  // -----------------------------------------------------------------------
  // Escape key closes modal (unless loading)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!open) return null;

  return (
    <div className="modal modal-open">
      <div
        className="modal-box max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Close ──────────────────────────────────────────────────── */}
        <button
          onClick={onClose}
          disabled={loading}
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          aria-label="关闭"
        >
          ✕
        </button>

        {/* ── Title ──────────────────────────────────────────────────── */}
        <h3 className="text-lg font-semibold">🔄 视角转换</h3>
        <p className="text-sm text-base-content/50 mt-1 mb-4">
          将上帝视角的章纲转换为沉浸式的第二人称写作指引
        </p>

        {/* ── Original Summary ───────────────────────────────────────── */}
        <div className="mb-4">
          <label className="text-xs font-medium text-base-content/60 mb-1.5 block">
            原始大纲摘要
          </label>
          <div className="bg-base-200/30 rounded-lg p-3 font-serif text-sm text-base-content/70 leading-relaxed max-h-32 overflow-y-auto">
            {chapterSummary || "无摘要内容"}
          </div>
        </div>

        {/* ── Perspective Guidance ───────────────────────────────────── */}
        <div className="mb-4">
          <label className="text-xs font-medium text-base-content/60 mb-1.5 block">
            视角转换指引
          </label>
          <div className="border border-base-300 rounded-lg p-4 min-h-[160px] whitespace-pre-wrap font-serif text-sm leading-relaxed">
            {loading && (
              <div className="flex items-center justify-center gap-2 text-base-content/40 h-full min-h-[6rem]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>转换中...</span>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[6rem]">
                <p className="text-error text-sm text-center max-w-md">
                  {error}
                </p>
                <button
                  onClick={fetchPerspective}
                  className="link link-hover text-xs text-base-content/50"
                >
                  重试
                </button>
              </div>
            )}

            {!loading && !error && !guidance && (
              <div className="flex items-center justify-center text-base-content/30 text-sm h-full min-h-[6rem]">
                点击"重新生成"开始转换
              </div>
            )}

            {!loading && !error && guidance && <div>{guidance}</div>}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <button
            onClick={fetchPerspective}
            disabled={loading}
            className="btn btn-outline btn-sm gap-1.5"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            重新生成
          </button>
          <button
            onClick={() => {
              onSaved(guidance);
              onClose();
            }}
            disabled={loading || !guidance}
            className="btn btn-primary btn-sm gap-1.5"
          >
            <Check className="w-4 h-4" />
            确认并保存
          </button>
        </div>
      </div>

      {/* Backdrop — removed when loading to prevent accidental close */}
      {!loading && <div className="modal-backdrop" onClick={onClose} />}
    </div>
  );
}
