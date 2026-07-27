import { useState } from "react";
import { Book, ChevronDown } from "lucide-react";
import OutlineChapterCard from "./OutlineChapterCard";
import type { OutlineStatus } from "@/hooks/useOutline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChapterCardData {
  ref: string;
  index: number;
  title: string;
  summary: string;
  status: OutlineStatus;
  hasPerspectiveGuidance: boolean;
}

interface OutlineVolumeCardProps {
  volumeRef: string;
  volNumber: number;
  title: string;
  chapterCount: number;
  chapters: ChapterCardData[];
  onEditChapter: (ref: string) => void;
  onConfirmChapter: (ref: string) => void;
  onPerspectiveChapter: (ref: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OutlineVolumeCard({
  volumeRef,
  volNumber,
  title,
  chapterCount,
  chapters,
  onEditChapter,
  onConfirmChapter,
  onPerspectiveChapter,
}: OutlineVolumeCardProps) {
  const allConfirmed = chapters.every(
    (ch) => ch.status === "confirmed",
  );
  const [expanded, setExpanded] = useState(!allConfirmed);

  const confirmedCount = chapters.filter(
    (ch) => ch.status === "confirmed",
  ).length;
  const progress =
    chapterCount > 0
      ? Math.round((confirmedCount / chapterCount) * 100)
      : 0;

  return (
    <div className="card bg-base-100 border border-base-300">
      {/* ── Collapsible header ──────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-base-200/50 transition-colors rounded-t-xl"
      >
        <Book className="w-4 h-4 text-primary/60 flex-shrink-0" />
        <span className="text-sm font-medium text-base-content flex-1 text-left truncate">
          {`第${volNumber}卷：${title || "未命名卷"}`}
        </span>
        <span className="text-xs text-base-content/40 tabular-nums flex-shrink-0">
          {chapterCount} 章
        </span>

        {/* Progress bar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-20 h-1.5 bg-base-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-base-content/40 tabular-nums w-8 text-right">
            {progress}%
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-base-content/40 transition-transform flex-shrink-0 ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      {/* ── Expanded chapter list ────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-base-300/50 px-1 pb-2">
          {chapters.length > 0 ? (
            chapters.map((ch) => (
              <OutlineChapterCard
                key={ch.ref}
                index={ch.index}
                title={ch.title}
                summary={ch.summary}
                status={ch.status}
                hasPerspectiveGuidance={ch.hasPerspectiveGuidance}
                onEdit={() => onEditChapter(ch.ref)}
                onConfirm={() => onConfirmChapter(ch.ref)}
                onPerspective={() => onPerspectiveChapter(ch.ref)}
              />
            ))
          ) : (
            <div className="text-center py-4 text-xs text-base-content/30">
              暂无章节
            </div>
          )}
        </div>
      )}
    </div>
  );
}
