import { useState } from "react";
import { BookOpen, ListTree, Settings2, Trash2 } from "lucide-react";
import CollapsibleSection from "../CollapsibleSection";
import DeleteConfirmModal from "../DeleteConfirmModal";
import StatusBadge from "../statusBadge";
import type { VolumeDetail } from "./types";

/** 卷工作台右栏：卷信息 / 章节导航 / 卷操作（非空卷删除的唯一入口） */
export default function VolumeToolbar({
  detail,
  volIndex,
  volTotal,
  onChapterSelect,
  onDeleteVolume,
}: {
  detail: VolumeDetail;
  volIndex: number;
  volTotal: number;
  onChapterSelect: (ref: string) => void;
  onDeleteVolume: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const chapters = detail.chapters || [];
  const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const confirmed = chapters.filter((c) => c.status === "confirmed").length;

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col overflow-y-auto border-l border-base-200/80 bg-base-100/50">
      <CollapsibleSection
        title="卷信息"
        icon={<BookOpen className="h-3.5 w-3.5 text-base-content/50" />}
      >
        <div className="grid grid-cols-2 gap-2">
          <Stat value={`${volIndex + 1} / ${volTotal}`} label="卷位置" />
          <Stat value={String(chapters.length)} label="章节数" />
          <Stat value={totalWords.toLocaleString()} label="本卷字数" />
          <Stat value={`${confirmed}/${chapters.length}`} label="已确认" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="章节导航"
        icon={<ListTree className="h-3.5 w-3.5 text-base-content/50" />}
      >
        {chapters.length === 0 ? (
          <p className="py-2 text-center text-xs text-base-content/30">
            本卷还没有章节
          </p>
        ) : (
          <div className="space-y-0.5">
            {chapters.map((c, i) => (
              <button
                key={c.ref}
                onClick={() => onChapterSelect(c.ref)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-base-200/50"
              >
                <span className="w-4 shrink-0 text-right tabular-nums text-base-content/30">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-base-content/70">
                  {c.title || `第${c.chapter}章`}
                </span>
                <StatusBadge status={c.status} />
              </button>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="卷操作"
        icon={<Settings2 className="h-3.5 w-3.5 text-base-content/50" />}
      >
        <button
          onClick={() => setConfirmOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-error/20 px-3 py-2 text-xs text-error/60 transition-colors hover:border-error/40 hover:text-error"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除本卷
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-base-content/30">
          将级联删除本卷全部章节，不可撤销；空卷也可在左侧树直接删除
        </p>
      </CollapsibleSection>

      {confirmOpen && (
        <DeleteConfirmModal
          title="卷"
          confirmText={detail.title || `第${detail.volume}卷`}
          description={`将级联删除本卷全部 ${chapters.length} 章及章纲、正文版本、归档与提示词，不可撤销。`}
          onConfirm={() => {
            setConfirmOpen(false);
            onDeleteVolume();
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </aside>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-base-200 bg-base-100 p-2.5 text-center">
      <div className="font-serif text-base font-bold tabular-nums text-base-content">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-base-content/40">{label}</div>
    </div>
  );
}
