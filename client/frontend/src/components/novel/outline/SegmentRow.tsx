import { memo } from "react";

interface SegmentRowProps {
  index: number;
  summary: string;
  targetWords: number;
  onChange: (summary: string, targetWords: number) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const SegmentRow = memo(function SegmentRow({
  index: _index,
  summary,
  targetWords,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SegmentRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg hover:bg-base-200/30 border border-transparent hover:border-base-300/40 transition-all group py-2 px-3">
      {/* Drag handle */}
      <span className="cursor-grab text-base-content/20 hover:text-base-content/40 select-none text-lg leading-none">
        &#x283F;
      </span>

      {/* Summary input */}
      <input
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/20"
        value={summary}
        onChange={(e) => onChange(e.target.value, targetWords)}
        placeholder="段落概要"
        maxLength={300}
      />

      {/* Target words */}
      <input
        type="number"
        className="w-20 bg-base-200/40 border border-base-300/60 rounded px-2 py-1 text-xs text-right outline-none focus:border-primary/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        value={targetWords || ""}
        onChange={(e) => onChange(summary, Math.max(0, parseInt(e.target.value, 10) || 0))}
        min={0}
        placeholder="字数"
      />

      {/* Up / Down arrows */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="btn btn-ghost btn-xs px-1 text-base-content/30 hover:text-base-content disabled:opacity-20 min-h-0 h-6"
          aria-label="上移"
        >
          &#x25B2;
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="btn btn-ghost btn-xs px-1 text-base-content/30 hover:text-base-content disabled:opacity-20 min-h-0 h-6"
          aria-label="下移"
        >
          &#x25BC;
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error transition-all text-sm px-1"
        aria-label="删除段落"
      >
        &#x2715;
      </button>
    </div>
  );
});

export default SegmentRow;
export type { SegmentRowProps };
