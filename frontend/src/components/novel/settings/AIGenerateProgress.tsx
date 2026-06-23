import { Sparkles, Check, AlertCircle, X } from "lucide-react";

interface ProgressStep {
  type: string;
  label: string;
  status: "pending" | "loading" | "done" | "error";
}

interface AIGenerateProgressProps {
  open: boolean;
  steps: ProgressStep[];
  onClose: () => void;
}

export default function AIGenerateProgress({ open, steps, onClose }: AIGenerateProgressProps) {
  if (!open) return null;

  const allDone = steps.every((s) => s.status === "done" || s.status === "error");

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base-content">AI 一键生成全部设定</h3>
        </div>

        {/* Progress list */}
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.type}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                step.status === "loading"
                  ? "border-primary/30 bg-primary/5"
                  : step.status === "done"
                    ? "border-success/20 bg-success/5"
                    : step.status === "error"
                      ? "border-error/20 bg-error/5"
                      : "border-base-300/40 bg-base-200/20"
              }`}
            >
              {/* Status icon */}
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {step.status === "loading" && <span className="loading loading-spinner loading-xs text-primary" />}
                {step.status === "done" && <Check className="w-4 h-4 text-success" />}
                {step.status === "error" && <AlertCircle className="w-4 h-4 text-error" />}
                {step.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-base-300/40" />}
              </div>
              {/* Label */}
              <span className={`text-sm flex-1 ${
                step.status === "done" ? "text-base-content" :
                step.status === "error" ? "text-error/80" :
                step.status === "loading" ? "text-primary" :
                "text-base-content/40"
              }`}>
                {step.label}
              </span>
              {/* Status text */}
              <span className="text-xs text-base-content/30">
                {step.status === "loading" ? "生成中…" :
                 step.status === "done" ? "已完成" :
                 step.status === "error" ? "失败" : "等待中"}
              </span>
            </div>
          ))}
        </div>

        {/* Close button */}
        {allDone && (
          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="btn btn-primary btn-sm">
              完成
            </button>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={allDone ? onClose : undefined} />
    </div>
  );
}
