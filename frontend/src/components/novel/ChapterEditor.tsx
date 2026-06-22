import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChapterEditorProps {
  projectId: string;
  chapterRef: string;
  onShowVersion: () => void;
}

interface ChapterData {
  volume: number;
  chapter: number;
  title: string;
  status: string;
  outline?: {
    summary?: string;
    [key: string]: any;
  };
  prose?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Status options
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "outline", label: "章纲" },
  { value: "writing", label: "写作中" },
  { value: "review", label: "待修改" },
  { value: "confirmed", label: "已完成" },
  { value: "archived", label: "已归档" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countChars(text: string): number {
  if (!text) return 0;
  return text.replace(/\s/g, "").length;
}

// ---------------------------------------------------------------------------
// ChapterEditor
// ---------------------------------------------------------------------------

export default function ChapterEditor({
  projectId,
  chapterRef,
  onShowVersion,
}: ChapterEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [outline, setOutline] = useState("");
  const [prose, setProse] = useState("");
  const [status, setStatus] = useState("outline");
  const [saving, setSaving] = useState(false);

  // Dirty tracking: store initial values to detect unsaved changes
  const [initialOutline, setInitialOutline] = useState("");
  const [initialProse, setInitialProse] = useState("");
  const [initialStatus, setInitialStatus] = useState("outline");

  const isDirty =
    outline !== initialOutline ||
    prose !== initialProse ||
    status !== initialStatus;

  // -----------------------------------------------------------------------
  // Load chapter data
  // -----------------------------------------------------------------------

  const loadChapter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: ChapterData = await api.get(
        `/projects/${projectId}/chapters/${chapterRef}`
      );
      setChapter(data);
      const summary = data.outline?.summary || "";
      const proseText = data.prose || "";
      const chStatus = data.status || "outline";
      setOutline(summary);
      setProse(proseText);
      setStatus(chStatus);
      setInitialOutline(summary);
      setInitialProse(proseText);
      setInitialStatus(chStatus);
    } catch (e: any) {
      setError(e.message || "加载章节失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, chapterRef]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------

  const handleSave = async () => {
    if (!chapter) return;
    setSaving(true);
    setError(null);
    try {
      const updated: ChapterData = {
        ...chapter,
        outline: { ...(chapter.outline || {}), summary: outline },
        prose,
        status,
      };
      await api.put(`/projects/${projectId}/chapters/${chapterRef}`, updated);
      setInitialOutline(outline);
      setInitialProse(prose);
      setInitialStatus(status);
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Word count
  // -----------------------------------------------------------------------

  const wordCount = countChars(prose);

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
        <button onClick={loadChapter} className="btn btn-ghost btn-sm">
          重试
        </button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // No data
  // -----------------------------------------------------------------------

  if (!chapter) return null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Chapter title + ref badge ──────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-serif font-semibold text-base-content">
          {chapter.title || `第${chapter.chapter}章`}
        </h2>
        <span className="badge badge-ghost badge-sm">{chapterRef}</span>
      </div>

      {/* ── Meta bar: status + word count + dirty badge ────────────── */}
      <div className="flex items-center gap-4 text-sm">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="select select-bordered select-sm max-w-[140px]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-base-content/40 tabular-nums">
          {wordCount} 字
        </span>
        {isDirty && (
          <span className="badge badge-warning badge-sm gap-1">
            ⚠️ 未保存
          </span>
        )}
      </div>

      {/* ── Version bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-sm text-base-content/40 select-none">
        <span>v1 · —</span>
        <button
          onClick={onShowVersion}
          className="btn btn-ghost btn-xs gap-1"
        >
          📋 历史版本
        </button>
      </div>

      {/* ── 章纲 (outline) ──────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="label-text font-medium text-base-content/80">
          章纲
        </label>
        <textarea
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
          className="textarea textarea-bordered w-full min-h-[120px] text-sm leading-relaxed"
          placeholder="章纲（概述本章情节走向）"
        />
      </div>

      {/* ── 正文 (prose) ────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="label-text font-medium text-base-content/80">
          正文
        </label>
        <textarea
          value={prose}
          onChange={(e) => setProse(e.target.value)}
          className="textarea textarea-bordered w-full font-serif text-base leading-[2] min-h-[300px] resize-y"
          placeholder="正文（在此撰写小说内容）"
        />
      </div>

      {/* ── Action bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-4 border-t border-base-300">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="btn btn-primary min-w-[80px]"
        >
          {saving && <span className="loading loading-spinner loading-xs" />}
          {saving ? "保存中…" : "保存"}
        </button>
        {error && <span className="text-error text-sm">{error}</span>}
      </div>
    </div>
  );
}
