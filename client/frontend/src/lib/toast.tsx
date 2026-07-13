import { useEffect, useState } from "react";

type ToastType = "error" | "success" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

let _toasts: Toast[] = [];
let _nextId = 1;
const _listeners = new Set<(toasts: Toast[]) => void>();

function notify() {
  for (const fn of _listeners) fn([..._toasts]);
}

function addToast(type: ToastType, msg: string, action?: ToastAction) {
  const id = _nextId++;
  _toasts.push({ id, message: msg, type, action });
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, 4000);
}

export const toast = {
  error(msg: string, opts?: { action?: ToastAction }) {
    addToast("error", msg, opts?.action);
  },
  success(msg: string, opts?: { action?: ToastAction }) {
    addToast("success", msg, opts?.action);
  },
  info(msg: string, opts?: { action?: ToastAction }) {
    addToast("info", msg, opts?.action);
  },
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    _listeners.add(setToasts);
    return () => { _listeners.delete(setToasts); };
  }, []);
  return toasts;
}

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  const bgMap: Record<ToastType, string> = {
    error: "alert alert-error",
    success: "alert alert-success",
    info: "alert alert-info",
  };

  return (
    <div className="toast toast-end toast-bottom z-50">
      {toasts.map((t) => (
        <div key={t.id} className={`${bgMap[t.type]} flex items-center gap-3`}>
          <span>{t.message}</span>
          {t.action && (
            <button
              onClick={t.action.onClick}
              className="btn btn-ghost btn-xs text-current font-medium opacity-70 hover:opacity-100"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
