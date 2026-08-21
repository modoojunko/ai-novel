import StatusBadge from "../statusBadge";
import type { VolumeChapterMeta } from "./types";

/** 本卷章节只读列表：行点击跳章正文；建/删结构走左树（无操作按钮） */
export default function VolumeChapterList({
  chapters,
  onChapterSelect,
}: {
  chapters: VolumeChapterMeta[];
  onChapterSelect: (ref: string) => void;
}) {
  const list = chapters || [];
  if (list.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-base-300/70 px-4 py-8 text-center text-sm text-base-content/30">
        本卷还没有章节，可在左侧树中新建
      </p>
    );
  }
  return (
    <div className="space-y-0.5">
      {list.map((ch, idx) => (
        <div
          key={ch.ref}
          className="group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-base-200/70"
        >
          <span className="w-6 shrink-0 text-right text-sm tabular-nums text-base-content/40">
            {idx + 1}
          </span>
          <button
            onClick={() => onChapterSelect(ch.ref)}
            className="min-w-0 flex-1 truncate text-left text-sm text-base-content/85 transition-colors hover:text-primary"
          >
            {ch.title || `第${ch.chapter}章`}
          </button>
          <span className="shrink-0 text-xs tabular-nums text-base-content/30">
            {ch.word_count || 0} 字
          </span>
          <StatusBadge status={ch.status} />
        </div>
      ))}
    </div>
  );
}
