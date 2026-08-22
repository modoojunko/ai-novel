import { useEffect, useState } from "react";
import { Ico, P } from "@/components/icons";

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

/** 设计系统 toast（list.html .toast-wrap/.toast）：底部居中深底胶囊。 */
export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={"toast" + (t.type === "error" ? " err" : "")}>
          {t.type === "success" ? (
            <Ico d={P.check} sw={2.2} />
          ) : t.type === "error" ? (
            <Ico d={P.close} sw={2.2} />
          ) : (
            <Ico d={P.other} sw={2.2} />
          )}
          <span>{t.message}</span>
          {t.action && (
            <button
              onClick={t.action.onClick}
              style={{ color: "inherit", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
