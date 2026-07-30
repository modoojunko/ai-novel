import { X, AlertTriangle, ArrowRight } from "lucide-react";
import type { GateWarning } from "@/hooks/useNovelState";

interface GateBannerProps {
  warnings: GateWarning[];
  hardGate?: {
    message: string;
    actionLabel: string;
    onAction: () => void;
  };
  onDismiss: () => void;
}

export default function GateBanner({ warnings, hardGate, onDismiss }: GateBannerProps) {
  // Nothing to show
  if (hardGate && !hardGate.message && warnings.length === 0) return null;
  if (!hardGate && warnings.length === 0) return null;

  // Hard gate variant — takes precedence
  if (hardGate) {
    return (
      <div
        role="alert"
        className="sticky top-0 z-40 alert alert-error rounded-none border-b-2 border-error/30 gate-slide-down"
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{hardGate.message}</span>
          </div>
          <button
            onClick={hardGate.onAction}
            className="btn btn-sm btn-error"
          >
            {hardGate.actionLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Soft gate variant
  return (
    <div
      role="alert"
      className="sticky top-0 z-40 alert alert-warning rounded-none border-b-2 border-warning/30 gate-slide-down"
    >
      <div className="flex items-start justify-between w-full gap-2">
        <div className="flex flex-col gap-1">
          {warnings.length === 1 ? (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{warnings[0].message}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-medium">以下阶段尚未就绪</span>
              </div>
              <ul className="list-disc list-inside text-sm ml-6 space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="btn btn-ghost btn-xs btn-circle shrink-0"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
