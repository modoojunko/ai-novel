import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChapterMeta {
  chapter: number;
  title: string;
  word_count?: number;
  status?: string;
}

interface VolumeData {
  volume: number;
  title: string;
  summary: string;
  chapters: ChapterMeta[];
}

interface VolumeEditorProps {
  projectId: string;
  volumeRef: string;
  onChapterSelect: (chapterRef: string) => void;
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  outline: "细纲",
  draft: "草稿",
  confirmed: "已确认",
  archived: "已归档",
};

function statusBadge(status?: string) {
  if (!status) return null;
  const label = STATUS_LABELS[status] || status;
  let cls = "badge badge-sm ";
  switch (status) {
    case "confirmed":
      cls += "badge-success";
      break;
    case "archived":
      cls += "badge-ghost";
      break;
    case "draft":
      cls += "badge-warning";
      break;
    default:
      cls += "badge-ghost";
  }
  return <span className={cls}>{label}</span>;
}

// ---------------------------------------------------------------------------
// VolumeEditor
// ---------------------------------------------------------------------------

export default function VolumeEditor({
  projectId,
  volumeRef,
  onChapterSelect,
}: VolumeEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VolumeData | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  const filename = `${volumeRef}.yaml`;

  // -----------------------------------------------------------------------
  // Load volume data
  // -----------------------------------------------------------------------

  const loadVolume = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: VolumeData = await api.get(
        `/projects/${projectId}/volumes/${filename}`
      );
      setData(res);
      setTitle(res.title || "");
      setSummary(res.summary || "");
    } catch (e: any) {
      setError(e.message || "加载卷信息失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, filename]);

  useEffect(() => {
    loadVolume();
  }, [loadVolume]);

  // -----------------------------------------------------------------------
  // Save volume
  // -----------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/projects/${projectId}/volumes/${filename}`, {
        title,
        summary,
      });
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Add chapter
  // -----------------------------------------------------------------------

  const handleAddChapter = async () => {
    const vol = data?.volume || 1;
    const nextNum = (data?.chapters?.length || 0) + 1;
    try {
      const result = await api.post(`/projects/${projectId}/chapters`, {
        volume: vol,
        chapter: nextNum,
        title: `第${nextNum}章`,
      });
      // Reload to reflect the new chapter in the list
      await loadVolume();
      // Navigate to the new chapter
      const ref = result.chapter_ref as string;
      if (ref) onChapterSelect(ref);
    } catch (e: any) {
      setError(e.message || "创建章节失败");
    }
  };

  // -----------------------------------------------------------------------
  // Delete chapter
  // -----------------------------------------------------------------------

  const handleDeleteChapter = async (ch: ChapterMeta) => {
    const chapterRef = `${volumeRef}-ch-${ch.chapter}`;
    try {
      await api.delete(`/projects/${projectId}/chapters/${chapterRef}`);
      await loadVolume();
    } catch (e: any) {
      setError(e.message || "删除章节失败");
    }
  };

  // -----------------------------------------------------------------------
  // Delete volume
  // -----------------------------------------------------------------------

  const handleDeleteVolume = async () => {
    if (!window.confirm("确定要删除本卷及其所有章节吗？")) return;
    try {
      await api.delete(`/projects/${projectId}/volumes/${filename}`);
      // Navigate back to parent — rely on parent to handle the empty state
      onChapterSelect("");
    } catch (e: any) {
      setError(e.message || "删除卷失败");
    }
  };

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-error text-sm">{error}</p>
        <button onClick={loadVolume} className="btn btn-ghost btn-sm">
          重试
        </button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // No data
  // -----------------------------------------------------------------------

  if (!data) return null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Volume name */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="input input-ghost w-full px-0 text-2xl font-serif font-semibold text-base-content focus:outline-none focus:border-b focus:border-primary/30"
        placeholder="卷名"
      />

      {/* Version bar */}
      <div className="text-sm text-base-content/40 select-none">
        v1 · —
      </div>

      {/* Volume outline */}
      <div className="space-y-1.5">
        <label className="label-text font-medium text-base-content/80">
          卷纲
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="textarea textarea-bordered w-full min-h-[140px] text-sm leading-relaxed"
          placeholder="卷纲（概述本卷情节走向）"
        />
      </div>

      {/* Chapter list */}
      <div className="space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-base-content/80">章节列表</h3>
          <button onClick={handleAddChapter} className="btn btn-primary btn-sm">
            添加章节
          </button>
        </div>

        {/* Chapter rows */}
        <div className="space-y-0.5">
          {(data.chapters || []).map((ch, idx) => (
            <div
              key={ch.chapter}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-base-200/70 group transition-colors"
            >
              {/* Drag handle */}
              <span className="cursor-grab text-base-content/20 group-hover:text-base-content/40 select-none text-lg leading-none">
                ⠿
              </span>

              {/* Index */}
              <span className="text-sm text-base-content/40 w-5 text-right tabular-nums shrink-0">
                {idx + 1}
              </span>

              {/* Title */}
              <button
                onClick={() =>
                  onChapterSelect(`${volumeRef}-ch-${ch.chapter}`)
                }
                className="flex-1 text-left text-sm truncate hover:text-primary transition-colors"
              >
                {ch.title || `第${ch.chapter}章`}
              </button>

              {/* Word count */}
              <span className="text-xs text-base-content/30 tabular-nums shrink-0">
                {ch.word_count || 0} 字
              </span>

              {/* Status badge */}
              <div className="shrink-0">{statusBadge(ch.status)}</div>

              {/* Delete button */}
              <button
                onClick={() => handleDeleteChapter(ch)}
                className="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs text-error/60 hover:text-error transition-all shrink-0"
              >
                删除
              </button>
            </div>
          ))}

          {/* Empty state */}
          {(!data.chapters || data.chapters.length === 0) && (
            <div className="text-center py-8 text-sm text-base-content/30">
              暂无章节，点击上方"添加章节"创建第一章
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between pt-4 border-t border-base-300">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary min-w-[80px]"
        >
          {saving && <span className="loading loading-spinner loading-xs" />}
          {saving ? "保存中…" : "保存"}
        </button>

        <button
          onClick={handleDeleteVolume}
          className="btn btn-ghost btn-sm text-error/60 hover:text-error"
        >
          删除本卷
        </button>
      </div>
    </div>
  );
}
