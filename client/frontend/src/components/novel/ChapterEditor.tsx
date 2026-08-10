import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";
import { streamChapterWrite, streamChapterContinue, polishText, expandText } from "@/lib/ai";
import { getToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/env";
import { toast } from "@/lib/toast";
import {
  Archive,
  Copy,
  Eye,
  EyeOff,
  Search,
  Sparkles,
} from "lucide-react";
import { TabBar } from "./settings/FormField";
import { renderMarkdown } from "@/lib/markdown";
import { useSelectionCapture } from "@/lib/selection";
import type { SelectionCapture } from "@/lib/selection";
import ContrastPreviewModal from "./ContrastPreviewModal";
import { useChapterData } from "@/hooks/useChapterData";
import { useTier } from "@/hooks/useTier";
import { TierGate } from "./license/FeatureTier";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChapterEditorProps {
  projectId: string;
  chapterRef: string;
  onShowVersion: () => void;
  onAIStateChange?: (state: AIWritingState) => void;
  /** 专注模式由 Workbench 持有（FE-10）：隐藏章纲/工具栏，仅正文居中 */
  focusMode?: boolean;
}

export interface AIWritingState {
  hasSelection: boolean;
  selectedText: string;
  continueLoading: boolean;
  polishLoading: boolean;
  expandLoading: boolean;
}

export interface ChapterEditorHandle {
  hasSelection: boolean;
  selectedText: string;
  continueLoading: boolean;
  polishLoading: boolean;
  expandLoading: boolean;
  captureNow: () => SelectionCapture | null;
  handleContinueWriting: () => void;
  handlePolish: (capture: SelectionCapture) => void;
  handleExpand: (capture: SelectionCapture) => void;
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
// ChapterEditor
// ---------------------------------------------------------------------------

const ChapterEditor = forwardRef<ChapterEditorHandle, ChapterEditorProps>(
  function ChapterEditor(
    { projectId, chapterRef, onShowVersion, onAIStateChange, focusMode = false },
    ref,
  ) {
    const { isFree } = useTier();

    const {
      chapter,
      prose,
      summary,
      status,
      isDirty,
      saveState,
      wordCount,
      targetWords,
      setTargetWords,
      save,
      setProse,
      setSummary,
      setStatus,
      retry,
      archive,
      reload,
      loading,
      error,
      setError,
    } = useChapterData(projectId, chapterRef);

    const [previewMode, setPreviewMode] = useState(false);

    // View tabs + AI writing state
    const [viewTab, setViewTab] = useState<"prose" | "prompt">("prose");
    const [streaming, setStreaming] = useState(false);
    const [streamedText, setStreamedText] = useState("");
    const [promptText, setPromptText] = useState("");
    const streamControllerRef = useRef<AbortController | null>(null);

    // Quality check + archive state
    const [qcLoading, setQcLoading] = useState(false);
    const [qcResults, setQcResults] = useState<any>(null);
    const [archiving, setArchiving] = useState(false);

    // -----------------------------------------------------------------------
    // AI auxiliary writing state
    // -----------------------------------------------------------------------

    const [continueLoading, setContinueLoading] = useState(false);
    const [polishLoading, setPolishLoading] = useState(false);
    const [expandLoading, setExpandLoading] = useState(false);
    const [modifiedText, setModifiedText] = useState<string | null>(null);
    const [contrastMode, setContrastMode] = useState<"polish" | "expand" | null>(null);
    const [contrastError, setContrastError] = useState<string | null>(null);
    const [contrastCapture, setContrastCapture] = useState<SelectionCapture | null>(null);

    const isContrasting = contrastMode !== null;

    // -----------------------------------------------------------------------
    // Textarea ref + selection capture
    // -----------------------------------------------------------------------

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { hasSelection, selectedText, captureNow } = useSelectionCapture(textareaRef);

    // Track cursor position for "续写"
    const cursorPositionRef = useRef<number | null>(null);

    const updateCursorPosition = useCallback(() => {
      const el = textareaRef.current;
      if (el) {
        cursorPositionRef.current = el.selectionStart;
      }
    }, []);

    // Sync AI state to parent for RightToolbar mediation (免费态不接线)
    const prevAIStateRef = useRef<AIWritingState>({
      hasSelection: false,
      selectedText: "",
      continueLoading: false,
      polishLoading: false,
      expandLoading: false,
    });

    useEffect(() => {
      if (isFree) return; // N14：免费态不向上传播 AI 状态
      const next: AIWritingState = {
        hasSelection,
        selectedText,
        continueLoading,
        polishLoading,
        expandLoading,
      };
      const prev = prevAIStateRef.current;
      if (
        next.hasSelection !== prev.hasSelection ||
        next.selectedText !== prev.selectedText ||
        next.continueLoading !== prev.continueLoading ||
        next.polishLoading !== prev.polishLoading ||
        next.expandLoading !== prev.expandLoading
      ) {
        prevAIStateRef.current = next;
        onAIStateChange?.(next);
      }
    }, [hasSelection, selectedText, continueLoading, polishLoading, expandLoading, onAIStateChange, isFree]);

    // Clear QC results when prose changes (user edited after check)
    useEffect(() => {
      if (qcResults) setQcResults(null);
    }, [prose]);

    // -----------------------------------------------------------------------
    // Save status for UI display（四态 → 文案/颜色）
    // -----------------------------------------------------------------------

    const saveStatusLabel =
      saveState === "autosaving"
        ? "自动保存中…"
        : saveState === "failed"
          ? "保存失败"
          : saveState === "unsaved"
            ? "未保存"
            : "已保存";

    const saveStatusColor =
      saveState === "autosaving"
        ? "text-primary"
        : saveState === "failed"
          ? "text-error"
          : saveState === "unsaved"
            ? "text-warning"
            : "text-success/70";

    // -----------------------------------------------------------------------
    // AI writing: start full-chapter streaming
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
          setProse?.(fullText);
          setStreamedText("");
          save();
        },
        onError: (err: string) => {
          setStreaming(false);
          setError?.(err);
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
      setContinueLoading(false);
    }, []);

    // -----------------------------------------------------------------------
    // AI writing: continue from cursor (SSE)
    // -----------------------------------------------------------------------

    const handleContinueWriting = useCallback(() => {
      if (isFree) return; // 免费降级 no-op
      // Toggle: if already loading, stop instead
      if (continueLoading) {
        handleStopWriting();
        return;
      }

      const pos = cursorPositionRef.current ?? prose.length;

      setContinueLoading(true);
      setStreamedText("");

      const ctrl = streamChapterContinue(projectId, chapterRef, pos, {
        onChunk: (text: string) => {
          setStreamedText((prev) => prev + text);
        },
        onDone: (fullText: string) => {
          setContinueLoading(false);
          setProse?.(fullText);
          setStreamedText("");
          save();
        },
        onError: (err: string) => {
          setContinueLoading(false);
          setError?.(err);
          setStreamedText("");
        },
      });

      streamControllerRef.current = ctrl;
    }, [isFree, continueLoading, projectId, chapterRef, prose]);

    // -----------------------------------------------------------------------
    // AI auxiliary: polish selected text
    // -----------------------------------------------------------------------

    const handlePolish = useCallback(
      (capture: SelectionCapture) => {
        if (isFree) return;
        const { start, end, text, fullText } = capture;
        const contextBefore = fullText.slice(Math.max(0, start - 200), start);
        const contextAfter = fullText.slice(end, end + 200);

        setContrastCapture(capture);
        setContrastMode("polish");
        setPolishLoading(true);
        setModifiedText(null);
        setContrastError(null);

        polishText(projectId, chapterRef, text, contextBefore, contextAfter)
          .then((result) => {
            setModifiedText(result);
            setPolishLoading(false);
          })
          .catch((err: Error) => {
            setContrastError(err.message);
            setPolishLoading(false);
          });
      },
      [isFree, projectId, chapterRef],
    );

    // -----------------------------------------------------------------------
    // AI auxiliary: expand selected text
    // -----------------------------------------------------------------------

    const handleExpand = useCallback(
      (capture: SelectionCapture) => {
        if (isFree) return;
        const { start, end, text, fullText } = capture;
        const contextBefore = fullText.slice(Math.max(0, start - 200), start);
        const contextAfter = fullText.slice(end, end + 200);

        setContrastCapture(capture);
        setContrastMode("expand");
        setExpandLoading(true);
        setModifiedText(null);
        setContrastError(null);

        expandText(projectId, chapterRef, text, contextBefore, contextAfter)
          .then((result) => {
            setModifiedText(result);
            setExpandLoading(false);
          })
          .catch((err: Error) => {
            setContrastError(err.message);
            setExpandLoading(false);
          });
      },
      [isFree, projectId, chapterRef],
    );

    // -----------------------------------------------------------------------
    // Contrast modal actions
    // -----------------------------------------------------------------------

    const handleAcceptPolish = useCallback(() => {
      if (!contrastCapture || !modifiedText) return;
      const { start, end, fullText } = contrastCapture;
      const originalFullText = fullText;
      const newProse = fullText.slice(0, start) + modifiedText + fullText.slice(end);
      setProse?.(newProse);
      setContrastMode(null);
      setContrastCapture(null);
      setModifiedText(null);
      toast.success("已替换", {
        action: {
          label: "撤销",
          onClick: () => {
            setProse?.(originalFullText);
          },
        },
      });
    }, [contrastCapture, modifiedText]);

    const handleRejectPolish = useCallback(() => {
      setContrastMode(null);
      setContrastCapture(null);
      setModifiedText(null);
      setContrastError(null);
    }, []);

    const handleRetryPolish = useCallback(() => {
      if (!contrastCapture) return;
      const { start, end, text, fullText } = contrastCapture;
      const contextBefore = fullText.slice(Math.max(0, start - 200), start);
      const contextAfter = fullText.slice(end, end + 200);

      if (contrastMode === "polish") {
        setPolishLoading(true);
        setModifiedText(null);
        setContrastError(null);
        polishText(projectId, chapterRef, text, contextBefore, contextAfter)
          .then((result) => {
            setModifiedText(result);
            setPolishLoading(false);
          })
          .catch((err: Error) => {
            setContrastError(err.message);
            setPolishLoading(false);
          });
      } else if (contrastMode === "expand") {
        setExpandLoading(true);
        setModifiedText(null);
        setContrastError(null);
        expandText(projectId, chapterRef, text, contextBefore, contextAfter)
          .then((result) => {
            setModifiedText(result);
            setExpandLoading(false);
          })
          .catch((err: Error) => {
            setContrastError(err.message);
            setExpandLoading(false);
          });
      }
    }, [contrastCapture, contrastMode, projectId, chapterRef]);

    // -----------------------------------------------------------------------
    // Imperative handle（AI 方法免费降级 no-op）
    // -----------------------------------------------------------------------

    useImperativeHandle(
      ref,
      () => ({
        get hasSelection() {
          return isFree ? false : hasSelection;
        },
        get selectedText() {
          return isFree ? "" : selectedText;
        },
        get continueLoading() {
          return isFree ? false : continueLoading;
        },
        get polishLoading() {
          return isFree ? false : polishLoading;
        },
        get expandLoading() {
          return isFree ? false : expandLoading;
        },
        captureNow: () => (isFree ? null : captureNow()),
        handleContinueWriting,
        handlePolish,
        handleExpand,
      }),
      [isFree, hasSelection, selectedText, continueLoading, polishLoading, expandLoading, captureNow, handleContinueWriting, handlePolish, handleExpand],
    );

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

        const listRes = await fetch(
          `${base}/api/novels/${projectId}/chapters/${chapterRef}/prompts`,
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

        const prefix = `${chapterRef}-`;
        const suffix = "-prompt.md";
        const contents: string[] = [];

        for (const file of files) {
          const seg = file.replace(prefix, "").replace(suffix, "");
          const contentRes = await fetch(
            `${base}/api/novels/${projectId}/chapters/${chapterRef}/prompts/${seg}`,
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
    // Quality check handler（PRO 专属，免费隐藏）
    // -----------------------------------------------------------------------

    const handleQualityCheck = useCallback(async () => {
      if (!prose.trim()) return;
      setQcLoading(true);
      setQcResults(null);
      try {
        const res = await api.post(`/novels/${projectId}/chapters/${chapterRef}/write/quality-check`, {
          full_text: prose,
        });
        setQcResults(res);
      } catch (e: any) {
        setError?.(e.message || "质量检查失败");
      } finally {
        setQcLoading(false);
      }
    }, [projectId, chapterRef, prose]);

    // -----------------------------------------------------------------------
    // Archive handler
    // -----------------------------------------------------------------------

    const handleArchive = useCallback(async () => {
      if (!prose.trim()) return;
      if (!window.confirm("确认归档本章？归档后正文将锁定为只读状态。")) return;
      setArchiving(true);
      await archive();
      setArchiving(false);
    }, [prose, archive]);

    // 归档只读：status === "archived" 时 textarea readOnly + 顶部提示条
    const isArchived = status === "archived";

    // -----------------------------------------------------------------------
    // Compute cursor-split text for continue streaming display
    // -----------------------------------------------------------------------

    const cursorPos = cursorPositionRef.current;
    const proseBeforeCursor = cursorPos !== null ? prose.slice(0, cursorPos) : "";
    const proseAfterCursor = cursorPos !== null ? prose.slice(cursorPos) : "";

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
          <button onClick={() => void reload()} className="btn btn-ghost btn-sm">
            重试
          </button>
        </div>
      );
    }

    // No data
    if (!chapter) return null;

    // -----------------------------------------------------------------------
    // Focus mode — minimal writing environment（Workbench 持有，FE-10）
    // -----------------------------------------------------------------------

    if (focusMode) {
      return (
        <div className="h-full flex flex-col bg-base-100">
          {/* Archived 提示条 */}
          {isArchived && (
            <div className="px-4 py-1.5 text-xs bg-info/10 text-info border-b border-info/20">
              📦 本章已归档，正文为只读状态
            </div>
          )}

          {/* Prose area */}
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
            {previewMode ? (
              <div
                className="max-w-3xl mx-auto font-serif text-base leading-[2] text-base-content prose-headings:font-serif prose-headings:text-xl prose-headings:mt-8 prose-headings:mb-4"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={prose}
                onChange={(e) => setProse?.(e.target.value)}
                onMouseUp={updateCursorPosition}
                onKeyUp={updateCursorPosition}
                readOnly={isArchived}
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
        {/* ── Archived 提示条 ──────────────────────────────────────── */}
        {isArchived && (
          <div className="px-3 py-1.5 text-xs bg-info/10 text-info border border-info/20 rounded-lg">
            📦 本章已归档，正文为只读状态
          </div>
        )}

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
            onChange={(e) => setStatus?.(e.target.value)}
            disabled={isArchived}
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
            value={summary}
            onChange={(e) => setSummary?.(e.target.value)}
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
              </div>
            )}
          </TabBar>

          {viewTab === "prose" && (
            <div className="space-y-3">
              <TierGate feature="ai-generate">
                {!streaming && !continueLoading && (
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
              </TierGate>

              {streaming || continueLoading ? (
                <div className="space-y-3">
                  <div className="w-full min-h-[300px] p-4 rounded-lg border border-base-300 bg-base-100/50 font-serif text-base leading-[2] whitespace-pre-wrap">
                    {continueLoading ? (
                      <>
                        {proseBeforeCursor}
                        <span className="text-amber-600 dark:text-amber-400">
                          {streamedText}
                        </span>
                        {proseAfterCursor}
                      </>
                    ) : (
                      <>{streamedText}</>
                    )}
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
                  ref={textareaRef}
                  value={prose}
                  onChange={(e) => setProse?.(e.target.value)}
                  onMouseUp={updateCursorPosition}
                  onKeyUp={updateCursorPosition}
                  readOnly={isArchived}
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
              onClick={save}
              disabled={saveState === "autosaving" || !isDirty || isArchived}
              className="btn btn-primary btn-sm min-w-[72px]"
            >
              {saveState === "autosaving" && <span className="loading loading-spinner loading-xs" />}
              {saveState === "autosaving" ? "保存中…" : "保存"}
            </button>
            <span className={`text-xs ${saveStatusColor}`}>
              {saveStatusLabel}
            </span>
            {saveState === "failed" && (
              <button onClick={retry} className="btn btn-ghost btn-xs text-error">
                重试
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-base-content/50">
            <span className="tabular-nums">{wordCount} 字</span>
          </div>
        </div>

        {/* ── Quality Check + Archive（质量检查 PRO 专属） ───────────── */}
        <div className="flex items-center gap-3 pt-3">
          <TierGate feature="ai-generate">
            <button
              onClick={handleQualityCheck}
              disabled={qcLoading || !prose.trim()}
              className="btn btn-ghost btn-xs gap-1.5 text-base-content/50 hover:text-base-content disabled:opacity-30"
            >
              {qcLoading ? <span className="loading loading-spinner loading-xs" /> : <Search className="w-3.5 h-3.5" />}
              质量检查
            </button>
          </TierGate>
          <button
            onClick={handleArchive}
            disabled={archiving || !prose.trim() || isArchived}
            className="btn btn-ghost btn-xs gap-1.5 text-base-content/50 hover:text-base-content disabled:opacity-30"
          >
            {archiving ? <span className="loading loading-spinner loading-xs" /> : <Archive className="w-3.5 h-3.5" />}
            归档
          </button>
        </div>

        {/* ── Quality Check Results ────────────────────────── */}
        {qcResults && (
          <div className="mt-3 p-4 rounded-lg border border-base-300 bg-base-200/30 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-base-content/60">质量检查</span>
              <span className={`text-xs font-medium ${qcResults.passed ? "text-success" : "text-warning"}`}>
                {qcResults.passed ? "✅ 通过" : "⚠️ 需修改"}
              </span>
            </div>
            {Object.entries(qcResults.checks || {}).map(([key, check]: [string, any]) => (
              <div key={key} className="flex items-center gap-2 text-xs text-base-content/60">
                <span>{check.passed ? "✅" : "❌"}</span>
                <span className="flex-1 capitalize">{key.replace(/_/g, " ")}</span>
                {check.detail && <span className="text-base-content/40 truncate max-w-[200px]">{check.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && chapter && (
          <p className="text-error text-xs text-center">{error}</p>
        )}

        {/* ── AI Contrast Modal ────────────────────────────── */}
        {isContrasting && (
          <ContrastPreviewModal
            open={isContrasting}
            onClose={handleRejectPolish}
            mode={contrastMode}
            originalText={contrastCapture?.text ?? ""}
            modifiedText={modifiedText}
            loading={polishLoading || expandLoading}
            error={contrastError}
            onAccept={handleAcceptPolish}
            onReject={handleRejectPolish}
            onRetry={handleRetryPolish}
          />
        )}
      </div>
    );
  },
);

export default ChapterEditor;
