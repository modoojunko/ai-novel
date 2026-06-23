import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { streamChapterWrite } from "@/lib/ai";
import { getToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/env";
import { Copy, Eye, EyeOff, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { TabBar } from "./settings/FormField";

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

function renderMarkdown(text: string): string {
  if (!text) return '<p class="text-base-content/40">暂无内容</p>';

  // Escape HTML to prevent XSS
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped.split(/\n\n+/);

  return paragraphs
    .map((para) => {
      const t = para.trim();
      if (!t) return "";

      // Horizontal rule
      if (/^-{3,}$/.test(t)) return "<hr>";

      // Inline formatting
      let html = t
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code>$1</code>");

      // Line breaks within paragraph
      html = html.replace(/\n/g, "<br>");

      return `<p>${html}</p>`;
    })
    .filter(Boolean)
    .join("\n");
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
  const [previewMode, setPreviewMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // View tabs + AI writing state
  const [viewTab, setViewTab] = useState<"prose" | "prompt">("prose");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [promptText, setPromptText] = useState("");
  const streamControllerRef = useRef<AbortController | null>(null);

  // Dirty tracking
  const [initialOutline, setInitialOutline] = useState("");
  const [initialProse, setInitialProse] = useState("");
  const [initialStatus, setInitialStatus] = useState("outline");

  const isDirty =
    outline !== initialOutline ||
    prose !== initialProse ||
    status !== initialStatus;

  // Refs for auto-save (avoid stale closures in timer callbacks)
  const savingRef = useRef(false);
  const proseRef = useRef(prose);
  const outlineRef = useRef(outline);
  const statusRef = useRef(status);
  const chapterDataRef = useRef<ChapterData | null>(chapter);

  // Keep refs in sync
  useEffect(() => { savingRef.current = saving; }, [saving]);
  useEffect(() => { proseRef.current = prose; }, [prose]);
  useEffect(() => { outlineRef.current = outline; }, [outline]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { chapterDataRef.current = chapter; }, [chapter]);

  // Save status for UI display
  const saveStatusLabel = saving
    ? "自动保存中…"
    : error
      ? "保存失败"
      : isDirty
        ? "未保存"
        : "已保存";

  const saveStatusColor = saving
    ? "text-primary"
    : error
      ? "text-error"
      : isDirty
        ? "text-warning"
        : "text-success/70";

  const wordCount = countChars(prose);

  // -----------------------------------------------------------------------
  // Core save logic via ref (always has access to latest state)
  // -----------------------------------------------------------------------

  const saveFnRef = useRef<(() => Promise<void>) | null>(null);
  saveFnRef.current = async () => {
    if (savingRef.current) return;
    const ch = chapterDataRef.current;
    if (!ch) return;
    setSaving(true);
    setError(null);
    try {
      const updated: ChapterData = {
        ...ch,
        outline: { ...(ch.outline || {}), summary: outlineRef.current },
        prose: proseRef.current,
        status: statusRef.current,
      };
      await api.put(
        `/projects/${projectId}/chapters/${chapterRef}`,
        updated
      );
      setInitialOutline(outlineRef.current);
      setInitialProse(proseRef.current);
      setInitialStatus(statusRef.current);
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Auto-save: debounce 3s after content change
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => saveFnRef.current?.(), 3000);
    return () => clearTimeout(timer);
  }, [outline, prose, status, isDirty]);

  // -----------------------------------------------------------------------
  // Manual save handler
  // -----------------------------------------------------------------------

  const handleSave = useCallback(() => {
    saveFnRef.current?.();
  }, []);

  // -----------------------------------------------------------------------
  // AI writing: start streaming
  // -----------------------------------------------------------------------

  const handleStartWriting = useCallback(() => {
    setStreaming(true);
    setStreamedText("");

    const ctrl = streamChapterWrite(projectId, chapterRef, {
      onChunk: (text: string) => {
        setStreamedText((prev) => prev + text);
      },
      onDone: (fullText: string) => {
        setStreaming(false);
        setProse(fullText);
        setInitialProse(fullText);
        setStreamedText("");
        // Auto-save after AI completes
        saveFnRef.current?.();
      },
      onError: (error: string) => {
        setStreaming(false);
        setError(error);
      },
    });

    streamControllerRef.current = ctrl;
  }, [projectId, chapterRef]);

  // -----------------------------------------------------------------------
  // AI writing: stop streaming
  // -----------------------------------------------------------------------

  const handleStopWriting = useCallback(() => {
    streamControllerRef.current?.abort();
    setStreaming(false);
  }, []);

  // -----------------------------------------------------------------------
  // Prompt: copy to clipboard
  // -----------------------------------------------------------------------

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      // Clipboard not available
    }
  }, [promptText]);

  // -----------------------------------------------------------------------
  // Prompt: load prompt content
  // -----------------------------------------------------------------------

  const loadPrompt = useCallback(async () => {
    if (promptText) return; // Already loaded
    setPromptText("加载中…");
    try {
      const token = getToken();
      const base = getApiBaseUrl();

      // List prompt files for this chapter
      const listRes = await fetch(
        `${base}/api/projects/${projectId}/chapters/${chapterRef}/prompts`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!listRes.ok) {
        setPromptText("暂无提示词");
        return;
      }
      const files: string[] = await listRes.json();
      if (!files.length) {
        setPromptText("暂无提示词");
        return;
      }

      // Fetch each segment's prompt content
      const prefix = `${chapterRef}-`;
      const suffix = "-prompt.md";
      const contents: string[] = [];

      for (const file of files) {
        const seg = file.replace(prefix, "").replace(suffix, "");
        const contentRes = await fetch(
          `${base}/api/projects/${projectId}/chapters/${chapterRef}/prompts/${seg}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (contentRes.ok) {
          const text = await contentRes.text();
          contents.push(`## ${seg}\n\n${text}`);
        }
      }

      setPromptText(contents.join("\n\n---\n\n") || "暂无提示词");
    } catch {
      setPromptText("暂无提示词");
    }
  }, [projectId, chapterRef, promptText]);

  // Load prompt when switching to the prompt tab
  useEffect(() => {
    if (viewTab === "prompt") {
      loadPrompt();
    }
  }, [viewTab, loadPrompt]);

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

  // Preview HTML (memoized)
  const previewHtml = useMemo(() => renderMarkdown(prose), [prose]);

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

  if (error && !chapter) {
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
  // Focus mode — minimal writing environment
  // -----------------------------------------------------------------------

  if (focusMode) {
    return (
      <div className="h-full flex flex-col bg-base-100">
        {/* Slim focus bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-200/50">
          <button
            onClick={() => setFocusMode(false)}
            className="btn btn-ghost btn-xs gap-1.5 text-base-content/60 hover:text-base-content"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            退出专注
          </button>

          <div className="flex items-center gap-4 text-xs text-base-content/50">
            <span className="tabular-nums">{wordCount} 字</span>
            <span className={saveStatusColor}>{saveStatusLabel}</span>
          </div>
        </div>

        {/* Prose area */}
        <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
          {previewMode ? (
            <div
              className="max-w-3xl mx-auto font-serif text-base leading-[2] text-base-content prose-headings:font-serif prose-headings:text-xl prose-headings:mt-8 prose-headings:mb-4"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <textarea
              value={prose}
              onChange={(e) => setProse(e.target.value)}
              className="w-full h-full max-w-3xl mx-auto block font-serif text-base leading-[2] resize-none bg-transparent border-none outline-none placeholder:text-base-content/20"
              placeholder="开始写作……"
              autoFocus
            />
          )}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Normal mode — full editor layout
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto space-y-5">
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
          <span className="text-xs">📋</span>
          历史版本
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
          className="textarea textarea-bordered w-full min-h-[100px] text-sm leading-relaxed"
          placeholder="章纲（概述本章情节走向）"
        />
      </div>

      {/* ── 正文 / 提示词 (view tabs) ──────────────────────────────── */}
      <style>{`
        @keyframes blink-cursor {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
      <div className="space-y-1.5">
        <TabBar
          tabs={[
            { id: "prose", label: "正文" },
            { id: "prompt", label: "提示词" },
          ]}
          activeTab={viewTab}
          onTabChange={(tab) => setViewTab(tab as "prose" | "prompt")}
        >
          {viewTab === "prose" && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`btn btn-ghost btn-xs gap-1 ${
                  previewMode ? "text-primary" : "text-base-content/50"
                }`}
                title={previewMode ? "切换到编辑" : "预览 Markdown"}
              >
                {previewMode ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                {previewMode ? "编辑" : "预览"}
              </button>
              <button
                onClick={() => setFocusMode(true)}
                className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-base-content"
                title="专注模式"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                专注
              </button>
            </div>
          )}
        </TabBar>

        {viewTab === "prose" && (
          <div className="space-y-3">
            {!streaming && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStartWriting}
                  className="btn btn-primary btn-sm gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI 写本章
                </button>
              </div>
            )}

            {streaming ? (
              <div className="space-y-3">
                <div className="w-full min-h-[300px] p-4 rounded-lg border border-base-300 bg-base-100/50 font-serif text-base leading-[2] whitespace-pre-wrap">
                  {streamedText}
                  <span
                    className="inline-block w-0.5 h-5 bg-primary align-middle ml-0.5"
                    style={{ animation: "blink-cursor 1s step-end infinite" }}
                  />
                </div>
                <button
                  onClick={handleStopWriting}
                  className="btn btn-error btn-sm gap-1.5"
                >
                  ⏹ 停止
                </button>
              </div>
            ) : previewMode ? (
              <div
                className="w-full font-serif text-base leading-[2] min-h-[300px] p-4 rounded-lg border border-base-300 bg-base-100/50 text-base-content"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <textarea
                value={prose}
                onChange={(e) => setProse(e.target.value)}
                className="textarea textarea-bordered w-full font-serif text-base leading-[2] min-h-[300px] resize-y"
                placeholder="正文（在此撰写小说内容）"
              />
            )}
          </div>
        )}

        {viewTab === "prompt" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={handleCopyPrompt}
                className="btn btn-ghost btn-xs gap-1 text-base-content/50"
              >
                <Copy className="w-3.5 h-3.5" />
                复制
              </button>
            </div>
            <pre className="w-full min-h-[300px] p-4 rounded-lg border border-base-300 bg-base-100/50 text-sm font-mono leading-relaxed overflow-auto whitespace-pre-wrap">
              {promptText || "暂无提示词"}
            </pre>
          </div>
        )}
      </div>

      {/* ── Toolbar: save + status + toggles ─────────────────────────── */}
      <div className="flex items-center justify-between pt-4 border-t border-base-300">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="btn btn-primary btn-sm min-w-[72px]"
          >
            {saving && <span className="loading loading-spinner loading-xs" />}
            {saving ? "保存中…" : "保存"}
          </button>
          <span className={`text-xs ${saveStatusColor}`}>
            {saveStatusLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-base-content/50">
          <span className="tabular-nums">{wordCount} 字</span>
        </div>
      </div>

      {/* Error message */}
      {error && chapter && (
        <p className="text-error text-xs text-center">{error}</p>
      )}
    </div>
  );
}
