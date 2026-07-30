import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArchiveReaderProps {
  projectId: string;
  filename: string;
  chapterRef: string;
  volume?: number;
  chapter?: number;
  title?: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onEdit: (chapterRef: string) => void;
}

// ---------------------------------------------------------------------------
// ArchiveReader
// ---------------------------------------------------------------------------

export default function ArchiveReader({
  projectId,
  filename,
  chapterRef,
  volume,
  chapter,
  title,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onBack,
  onEdit,
}: ArchiveReaderProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Load archive content
  // -----------------------------------------------------------------------

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    setContent(null);
    try {
      const data: { filename: string; content: string } = await api.get(
        `/novels/${projectId}/archives/${encodeURIComponent(filename)}`
      );
      setContent(data.content);
    } catch (e: any) {
      setError(e.message || "加载归档内容失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, filename]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Reset scroll on filename change
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    setScrollProgress(0);
  }, [filename]);

  // -----------------------------------------------------------------------
  // Scroll progress
  // -----------------------------------------------------------------------

  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) {
      setScrollProgress(100);
      return;
    }
    const progress = (el.scrollTop / maxScroll) * 100;
    setScrollProgress(Math.min(100, Math.max(0, progress)));
  }, []);

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          if (hasPrev) {
            e.preventDefault();
            onPrev();
          }
          break;
        case "ArrowRight":
          if (hasNext) {
            e.preventDefault();
            onNext();
          }
          break;
        case "Escape":
          e.preventDefault();
          onBack();
          break;
        case "e":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onEdit(chapterRef);
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasPrev, hasNext, onPrev, onNext, onBack, onEdit, chapterRef]);

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const proseHtml = useMemo(() => {
    if (!content) return "";
    return renderMarkdown(content);
  }, [content]);

  const wordCount = useMemo(() => {
    if (!content) return 0;
    return content.replace(/\s/g, "").length;
  }, [content]);

  const displayTitle =
    title || (chapter ? `第${chapter}章` : filename.replace(/\.md$/, ""));
  const displayVolume = volume ? `第${volume}卷` : "";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-200/50 flex-shrink-0">
        <button
          onClick={onBack}
          className="btn btn-ghost btn-sm gap-1 text-base-content/60 hover:text-base-content"
        >
          <ArrowLeft className="w-4 h-4" />
          归档列表
        </button>

        <div className="text-sm text-base-content/70 truncate mx-2 text-center">
          {[displayVolume, displayTitle].filter(Boolean).join(" · ")}
        </div>

        <button
          onClick={() => onEdit(chapterRef)}
          className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-base-content flex-shrink-0"
          title="在编辑器中打开"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          编辑
        </button>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────── */}
      <div className="h-1 bg-base-200 w-full flex-shrink-0 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* ── Content scroll area ──────────────────────────────────── */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-sm text-base-content/40">加载中...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error text-xl">
              !
            </div>
            <p className="text-sm text-error">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={loadContent}
                className="btn btn-ghost btn-sm"
              >
                重试
              </button>
              <button onClick={onBack} className="btn btn-ghost btn-sm">
                返回列表
              </button>
            </div>
          </div>
        )}

        {!loading && !error && !content && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            <BookOpen className="w-12 h-12 opacity-30 text-base-content/40" />
            <p className="text-sm text-base-content/40">
              此章节暂无可读内容
            </p>
          </div>
        )}

        {!loading && !error && content && (
          <div className="max-w-[70ch] mx-auto px-4 py-8">
            <h1 className="text-2xl font-serif font-semibold text-base-content mb-8 text-center">
              {displayTitle}
            </h1>

            <div
              className="font-serif text-base leading-[2] text-base-content prose-headings:font-serif prose-headings:text-xl prose-headings:mt-8 prose-headings:mb-4"
              dangerouslySetInnerHTML={{ __html: proseHtml }}
            />
          </div>
        )}
      </div>

      {/* ── Footer navigation ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-base-300 bg-base-200/50 flex-shrink-0">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className={`btn btn-ghost btn-sm gap-1 ${
            !hasPrev ? "opacity-30 cursor-not-allowed" : ""
          }`}
        >
          ◀ 上一章
        </button>

        <span className="text-xs text-base-content/40 tabular-nums">
          {wordCount.toLocaleString()} 字
        </span>

        <button
          onClick={onNext}
          disabled={!hasNext}
          className={`btn btn-ghost btn-sm gap-1 ${
            !hasNext ? "opacity-30 cursor-not-allowed" : ""
          }`}
        >
          下一章 ▶
        </button>
      </div>
    </div>
  );
}
