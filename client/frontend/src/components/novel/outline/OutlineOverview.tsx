import { Check, FileText, RotateCw } from "lucide-react";
import OutlineVolumeCard from "./OutlineVolumeCard";
import type {
  VolumeEntry,
  ChapterData,
  OutlineStatus,
} from "@/hooks/useOutline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OutlineOverviewProps {
  volumes: VolumeEntry[];
  chapterStatuses: Map<string, OutlineStatus>;
  chaptersMap: Map<string, ChapterData>;
  totalChapters: number;
  filledCount: number;
  confirmedCount: number;
  allConfirmed: boolean;
  allHavePerspectiveGuidance: boolean;
  loading: boolean;
  error: string | null;
  onEditChapter: (ref: string) => void;
  onConfirmChapter: (ref: string) => void;
  onPerspectiveChapter: (ref: string) => void;
  onGlobalConfirm: () => void;
  onRetry: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OutlineOverview({
  volumes,
  chapterStatuses,
  chaptersMap,
  totalChapters,
  filledCount,
  confirmedCount,
  allConfirmed,
  allHavePerspectiveGuidance,
  loading,
  error,
  onEditChapter,
  onConfirmChapter,
  onPerspectiveChapter,
  onGlobalConfirm,
  onRetry,
}: OutlineOverviewProps) {
  // -----------------------------------------------------------------------
  // Loading state — skeleton
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 w-full rounded-lg" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-error text-sm">{error}</p>
        <button onClick={onRetry} className="btn btn-ghost btn-sm gap-1.5">
          <RotateCw className="w-3.5 h-3.5" />
          重试
        </button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Empty state — no volumes at all
  // -----------------------------------------------------------------------

  if (!volumes || volumes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-4">
        <FileText className="w-16 h-16 opacity-30 text-base-content/40" />
        <h3 className="text-lg font-medium text-base-content/60">
          暂无细纲内容
        </h3>
        <p className="text-sm text-base-content/40 max-w-sm text-center leading-relaxed">
          请先在正文页面创建卷和章节，然后在此为每章填写细纲。
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Computed values for display
  // -----------------------------------------------------------------------

  const canGlobalConfirm = allConfirmed && allHavePerspectiveGuidance;
  const filledPercent =
    totalChapters > 0
      ? Math.round((filledCount / totalChapters) * 100)
      : 0;
  const confirmedPercent =
    totalChapters > 0
      ? Math.round((confirmedCount / totalChapters) * 100)
      : 0;

  const globalConfirmTitle = !allConfirmed
    ? "尚有未确认的章节"
    : !allHavePerspectiveGuidance
      ? "部分已确认章节缺少视角引导"
      : "确认全部章纲并推进到提示词阶段";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ── Global progress bar ──────────────────────────────────────── */}
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-base-content/70">
              已填{" "}
              <strong className="text-base-content">{filledCount}</strong>
              /{totalChapters} 章
            </span>
            <span className="text-base-content/70">
              已确认{" "}
              <strong className="text-base-content">
                {confirmedCount}
              </strong>
              /{totalChapters} 章
            </span>
          </div>
          <button
            onClick={onGlobalConfirm}
            disabled={!canGlobalConfirm}
            className={`btn btn-primary btn-sm gap-1.5 ${
              !canGlobalConfirm ? "btn-disabled" : ""
            }`}
            title={globalConfirmTitle}
          >
            <Check className="w-4 h-4" />
            确认全部章纲
          </button>
        </div>

        {/* Dual progress bars */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-base-content/50">
            <span>填写进度</span>
            <span className="tabular-nums">{filledPercent}%</span>
          </div>
          <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${filledPercent}%` }}
            />
          </div>
        </div>
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center gap-2 text-xs text-base-content/50">
            <span>确认进度</span>
            <span className="tabular-nums">{confirmedPercent}%</span>
          </div>
          <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-500"
              style={{ width: `${confirmedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Volume cards ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {volumes.map((vol) => {
          // Build chapter card data for this volume from chaptersMap + chapterStatuses
          const chapterCardData = vol.chapters.map((ch, idx) => {
            const chData = chaptersMap.get(ch.ref);
            const status = chapterStatuses.get(ch.ref) || "unfilled";
            const hasPG = !!chData?.outline?.perspective_guidance;
            return {
              ref: ch.ref,
              index: idx + 1,
              title: ch.title,
              summary: chData?.outline?.summary || "",
              status,
              hasPerspectiveGuidance: hasPG,
            };
          });

          return (
            <OutlineVolumeCard
              key={vol.ref}
              volumeRef={vol.ref}
              title={vol.title}
              chapterCount={vol.chapter_count}
              chapters={chapterCardData}
              onEditChapter={onEditChapter}
              onConfirmChapter={onConfirmChapter}
              onPerspectiveChapter={onPerspectiveChapter}
            />
          );
        })}
      </div>
    </div>
  );
}
