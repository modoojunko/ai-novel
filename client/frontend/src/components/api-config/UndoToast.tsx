import { useEffect, useRef, useState } from "react";
import { Ico, P } from "../icons";

interface UndoToastProps {
  configName: string;
  onUndo: () => Promise<void>;
  onExpire: () => void;
  /** 撤销窗口（原型 8s） */
  duration?: number;
}

/** 删除撤销 toast（model-config.html undoToast 原样：8 秒窗口 + 链接式撤销） */
export function UndoToast({ configName, onUndo, onExpire, duration = 8000 }: UndoToastProps) {
  const [undoing, setUndoing] = useState(false);
  const [fading, setFading] = useState(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    const fade = setTimeout(() => setFading(true), duration);
    const remove = setTimeout(() => expireRef.current(), duration + 300);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, [duration]);

  const handleUndo = async () => {
    setUndoing(true);
    try {
      await onUndo();
      expireRef.current();
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div
        className="toast"
        style={fading ? { transition: "opacity 0.3s", opacity: 0 } : undefined}
      >
        <Ico d={P.check} sw={2.2} />
        <span>已删除「{configName}」</span>
        <button className="undo" onClick={handleUndo} disabled={undoing}>
          {undoing ? "恢复中…" : "撤销"}
        </button>
      </div>
    </div>
  );
}
