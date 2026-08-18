import { useEffect, useReducer, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { AlertTriangle, Feather, Loader2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModalAction = { type: "SET_NAME"; value: string } | { type: "DISMISS" };

interface ModalState {
  name: string;
}

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (novelId: string) => void;
  /** 'none' when user is on the free tier */
  tier?: string;
  /** Current novel count, for free-limit check */
  novelCount?: number;
}

// ---------------------------------------------------------------------------
// Reducer — single-stage minimal: only a book name is collected
// ---------------------------------------------------------------------------

const INITIAL: ModalState = {
  name: "",
};

function reducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.value };
    case "DISMISS":
      return { ...INITIAL };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateProjectModal({
  open,
  onClose,
  onCreated,
  tier,
  novelCount,
}: CreateProjectModalProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      dispatch({ type: "DISMISS" });
      setSubmitting(false);
    }
  }, [open]);

  // Focus the name input when the modal opens
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Esc closes (locked while submitting)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (submitting) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  async function handleCreate() {
    const name = state.name.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      const novel = await api.createNovel({ name, source: "manual" });
      toast.success(`「${novel.name}」已创建`);
      onCreated(novel.id);
    } catch {
      toast.error("创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  const freeLimitReached =
    tier === "none" && novelCount !== undefined && novelCount >= 1;
  const canCreate = state.name.trim().length > 0 && !freeLimitReached;

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="modal modal-open" onClick={handleClose}>
        <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold font-serif text-lg">开始一部新小说</h3>
            <button
              onClick={handleClose}
              className="btn btn-sm btn-circle btn-ghost disabled:opacity-30 disabled:pointer-events-none"
              aria-label="关闭"
              disabled={submitting}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div style={{ animation: "fadeIn 300ms ease" }}>
            <div className="space-y-5">
              {/* 书名输入 */}
              <div>
                <label className="label py-1" htmlFor="novel-name">
                  <span className="label-text text-xs font-medium">书名</span>
                </label>
                <input
                  id="novel-name"
                  ref={inputRef}
                  className="input input-bordered w-full text-base"
                  placeholder="给你的小说起个名字"
                  maxLength={60}
                  value={state.name}
                  onChange={(e) =>
                    dispatch({ type: "SET_NAME", value: e.target.value })
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  disabled={submitting}
                  aria-label="小说书名"
                />
                {/* 改名提示 + 字数计数 */}
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-base-content/50 leading-relaxed">
                    可以先取个简单的名字，创建后随时能改
                  </p>
                  <span className="text-xs text-base-content/40 tabular-nums shrink-0 ml-2">
                    {state.name.length}/60
                  </span>
                </div>
              </div>

              {/* 主按钮：创建小说 */}
              <button
                className="btn btn-primary w-full"
                onClick={handleCreate}
                disabled={!canCreate || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    创建中…
                  </>
                ) : (
                  <>
                    <Feather className="w-4 h-4" />
                    创建小说
                  </>
                )}
              </button>

              {/* 免费限 1 本 */}
              {freeLimitReached && (
                <div className="alert alert-warning text-xs py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>免费用户限 1 本。升级套餐可创建更多小说。</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-backdrop" onClick={handleClose} />
      </div>
    </>
  );
}
