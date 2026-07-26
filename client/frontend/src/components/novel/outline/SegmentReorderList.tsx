import { useCallback } from "react";
import SegmentRow from "./SegmentRow";

interface Segment {
  summary: string;
  target_words: number;
}

interface SegmentReorderListProps {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
}

export default function SegmentReorderList({
  segments,
  onChange,
}: SegmentReorderListProps) {
  const totalWords = segments.reduce(
    (sum, s) => sum + (s.target_words || 0),
    0
  );

  const handleChange = useCallback(
    (index: number, summary: string, targetWords: number) => {
      const next = segments.map((seg, i) =>
        i === index ? { summary, target_words: targetWords } : seg
      );
      onChange(next);
    },
    [segments, onChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      onChange(segments.filter((_, i) => i !== index));
    },
    [segments, onChange]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const next = [...segments];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onChange(next);
    },
    [segments, onChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= segments.length - 1) return;
      const next = [...segments];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      onChange(next);
    },
    [segments, onChange]
  );

  const handleAdd = useCallback(() => {
    onChange([...segments, { summary: "", target_words: 0 }]);
  }, [segments, onChange]);

  return (
    <div className="space-y-1">
      {segments.map((seg, i) => (
        <SegmentRow
          key={i}
          index={i}
          summary={seg.summary}
          targetWords={seg.target_words}
          onChange={(summary, targetWords) =>
            handleChange(i, summary, targetWords)
          }
          onDelete={() => handleDelete(i)}
          onMoveUp={() => handleMoveUp(i)}
          onMoveDown={() => handleMoveDown(i)}
          isFirst={i === 0}
          isLast={i === segments.length - 1}
        />
      ))}

      <button
        onClick={handleAdd}
        className="text-xs text-primary/60 hover:text-primary transition-colors mt-2 inline-flex items-center gap-1"
      >
        + 添加段落
      </button>

      <p className="text-xs text-base-content/40 mt-2">
        共 {segments.length} 段，预计 {totalWords} 字
      </p>
    </div>
  );
}

export type { Segment, SegmentReorderListProps };
