import { useEffect, useState } from "react";

type ToastType = "error" | "success" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let _toasts: Toast[] = [];
let _nextId = 1;
const _listeners = new Set<(toasts: Toast[]) => void>();

function notify() {
  for (const fn of _listeners) fn([..._toasts]);
}

export const toast = {
  error(msg: string) {
    _toasts.push({ id: _nextId++, message: msg, type: "error" });
    notify();
    setTimeout(() => {
      _toasts = _toasts.filter((t) => t.id !== _nextId - 1);
      notify();
    }, 4000);
  },
  success(msg: string) {
    _toasts.push({ id: _nextId++, message: msg, type: "success" });
    notify();
    setTimeout(() => {
      _toasts = _toasts.filter((t) => t.id !== _nextId - 1);
      notify();
    }, 4000);
  },
  info(msg: string) {
    _toasts.push({ id: _nextId++, message: msg, type: "info" });
    notify();
    setTimeout(() => {
      _toasts = _toasts.filter((t) => t.id !== _nextId - 1);
      notify();
    }, 4000);
  },
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    _listeners.add(setToasts);
    return () => {
      _listeners.delete(setToasts);
    };
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
        <div key={t.id} className={bgMap[t.type]}>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
