"use client";

import { useState } from "react";

type Toast = { id: number; message: string; type: "error" | "success" | "info" };

const _listeners = new Set<(toasts: Toast[]) => void>();
let _toasts: Toast[] = [];
let _nextId = 1;

function notify(message: string, type: Toast["type"] = "info") {
  const id = _nextId++;
  _toasts = [..._toasts, { id, message, type }];
  _listeners.forEach((fn) => fn(_toasts));
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    _listeners.forEach((fn) => fn(_toasts));
  }, 4000);
}

export const toast = {
  error: (msg: string) => notify(msg, "error"),
  success: (msg: string) => notify(msg, "success"),
  info: (msg: string) => notify(msg, "info"),
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  _listeners.add(setToasts);
  return toasts;
}

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const style =
          t.type === "error"
            ? "bg-destructive text-white"
            : t.type === "success"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-foreground ring-1 ring-border";
        return (
          <div
            key={t.id}
            className={`${style} text-sm px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2`}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
