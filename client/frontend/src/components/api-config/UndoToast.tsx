import { useEffect, useState, useRef, useCallback } from "react";

interface UndoToastProps {
  configName: string;
  onUndo: () => Promise<void>;
  onExpire: () => void;
  duration?: number;
}

export function UndoToast({ configName, onUndo, onExpire, duration = 10000 }: UndoToastProps) {
  const [remaining, setRemaining] = useState(duration);
  const [undoing, setUndoing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const interval = 100;
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= interval) {
          clearTimer();
          onExpire();
          return 0;
        }
        return prev - interval;
      });
    }, interval);

    return clearTimer;
  }, [clearTimer, onExpire]);

  const handleUndo = async () => {
    setUndoing(true);
    try {
      await onUndo();
      clearTimer();
      onExpire();
    } finally {
      setUndoing(false);
    }
  };

  const progressPct = (remaining / duration) * 100;
  const isUrgent = remaining <= 3000;

  return (
    <div className="toast toast-bottom toast-center z-50">
      <div className="alert alert-info shadow-lg flex-row items-center gap-3 px-4 py-3 min-w-[320px]">
        <div className="flex-1 text-sm">
          已删除「{configName}」
        </div>
        <span className={`text-xs font-mono ${isUrgent ? "text-error" : "text-base-content/60"}`}>
          {Math.ceil(remaining / 1000)}s
        </span>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleUndo}
          disabled={undoing}
        >
          {undoing ? <span className="loading loading-spinner loading-xs" /> : null}
          撤销
        </button>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-base-300 rounded-b-xl overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${isUrgent ? "bg-error" : "bg-primary"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
