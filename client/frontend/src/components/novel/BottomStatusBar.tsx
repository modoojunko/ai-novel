import { useState } from "react";
import type { SaveState } from "@/hooks/useChapterData";

interface BottomStatusBarProps {
  wordCount: number;
  targetWords: number;
  onSetTargetWords: (n: number) => void;
  saveState: SaveState;
  onSave: () => void;
  onRetry: () => void;
}

const SAVE_LABEL: Record<SaveState, string> = {
  autosaving: "自动保存中…",
  saved: "已保存",
  unsaved: "未保存",
  failed: "保存失败",
};

const SAVE_COLOR: Record<SaveState, string> = {
  autosaving: "text-primary",
  saved: "text-success/70",
  unsaved: "text-warning",
  failed: "text-error",
};

export default function BottomStatusBar({
  wordCount,
  targetWords,
  onSetTargetWords,
  saveState,
  onSave,
  onRetry,
}: BottomStatusBarProps) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState(String(targetWords));

  const pct = targetWords > 0 ? Math.min(100, Math.round((wordCount / targetWords) * 100)) : 0;

  const commitTarget = () => {
    const n = parseInt(targetDraft, 10);
    if (Number.isFinite(n) && n > 0) {
      onSetTargetWords(n);
    } else {
      setTargetDraft(String(targetWords));
    }
    setEditingTarget(false);
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-t border-base-300 bg-base-200/50 h-9">
      {/* 保存四态 + 手动保存/重试 */}
      <div className="flex items-center gap-2 shrink-0">
        {saveState === "autosaving" ? (
          <span className="loading loading-spinner loading-xs text-primary" />
        ) : (
          <span className={`text-xs tabular-nums ${SAVE_COLOR[saveState]}`}>
            {SAVE_LABEL[saveState]}
          </span>
        )}
        {saveState === "failed" && (
          <button
            onClick={onRetry}
            className="btn btn-ghost btn-xs text-error px-1"
          >
            重试
          </button>
        )}
        {saveState === "unsaved" && (
          <button
            onClick={onSave}
            className="btn btn-ghost btn-xs text-primary px-1"
          >
            保存
          </button>
        )}
      </div>

      {/* 字数 + 内嵌进度条（N5/N13 同排） */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-base-content/60 tabular-nums shrink-0">
          {wordCount} 字
        </span>
        <progress
          className="progress progress-primary h-1.5 flex-1"
          value={pct}
          max={100}
        />
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-base-content/40">目标</span>
          {editingTarget ? (
            <input
              autoFocus
              className="input input-xs input-bordered w-16 text-xs"
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
              onBlur={commitTarget}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTarget();
                if (e.key === "Escape") {
                  setTargetDraft(String(targetWords));
                  setEditingTarget(false);
                }
              }}
              aria-label="目标字数"
            />
          ) : (
            <button
              onClick={() => {
                setTargetDraft(String(targetWords));
                setEditingTarget(true);
              }}
              className="text-xs text-base-content/70 hover:text-primary tabular-nums"
              title="点击调整目标字数"
            >
              {targetWords}
            </button>
          )}
        </div>
        <span className="text-xs text-base-content/40 tabular-nums shrink-0">
          {pct}%
        </span>
      </div>
    </div>
  );
}
