import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { getToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/env";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptFile {
  filename: string;
  seg: number;
  title: string;
}

interface ChapterPromptInfo {
  chapterRef: string;
  chapterTitle: string;
  segments: PromptFile[];
  status: "generated" | "partial" | "none" | "modified";
}

interface VolumeInfo {
  name: string;
  volNum: number;
  chapters: { ref: string; title: string }[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PromptManagementPageProps {
  projectId: string;
  /** 传入时 overview 只渲染该章的手风琴卡片（工作台「提示词」子 label 按当前章过滤，011） */
  chapterRef?: string;
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

/**
 * Parse a prompt filename like "vol-1-ch-1-seg-1-prompt.md" for a given
 * chapterRef into the segment key ("seg-1") and numeric index (1).
 */
function parsePromptFilename(
  chapterRef: string,
  filename: string,
): { segKey: string; segNum: number } | null {
  if (!filename.endsWith("-prompt.md")) return null;
  const withoutPrefix = filename.startsWith(chapterRef + "-")
    ? filename.slice(chapterRef.length + 1)
    : filename;
  const segPart = withoutPrefix.replace("-prompt.md", "");
  const match = segPart.match(/^seg-(\d+)$/);
  if (!match) return null;
  return { segKey: segPart, segNum: parseInt(match[1], 10) };
}

/**
 * Fetch raw text prompt content from the API (PlainTextResponse).
 */
async function fetchPromptText(
  projectId: string,
  chapterRef: string,
  segKey: string,
): Promise<string> {
  const token = getToken();
  const res = await fetch(
    `${getApiBaseUrl()}/api/novels/${projectId}/chapters/${chapterRef}/prompts/${segKey}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(errText || "获取提示词失败");
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromptManagementPage({
  projectId,
  chapterRef,
}: PromptManagementPageProps) {
  // ── Internal view state ────────────────────────────────────────────
  const [view, setView] = useState<"overview" | "viewer" | "editor">(
    "overview",
  );

  // ── Overview state ─────────────────────────────────────────────────
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [chapterPrompts, setChapterPrompts] = useState<
    Record<string, ChapterPromptInfo>
  >({});
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [generatingChapters, setGeneratingChapters] = useState<Set<string>>(
    new Set(),
  );
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(),
  );

  // 当前可见章节：传入 chapterRef 时只保留该章（工作台子 label 按当前章过滤）
  const visibleChapters = useMemo(
    () =>
      chapterRef
        ? volumes.flatMap((v) => v.chapters).filter((ch) => ch.ref === chapterRef)
        : volumes.flatMap((v) => v.chapters),
    [volumes, chapterRef],
  );

  // 传入 chapterRef 时自动展开该章，直达提示词列表
  useEffect(() => {
    if (chapterRef) setExpandedChapters(new Set([chapterRef]));
  }, [chapterRef]);

  // ── Viewer / editor state ──────────────────────────────────────────
  const [viewerChapterRef, setViewerChapterRef] = useState("");
  const [viewerSegKey, setViewerSegKey] = useState("");
  const [viewerSegTitle, setViewerSegTitle] = useState("");
  const [viewerContent, setViewerContent] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [modifiedSegs, setModifiedSegs] = useState<Set<string>>(new Set());

  // ── Editor state ───────────────────────────────────────────────────
  const [editorContent, setEditorContent] = useState("");
  const [saving, setSaving] = useState(false);

  // =====================================================================
  // Data loading
  // =====================================================================

  // Load volumes & chapters
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function load() {
      setOverviewLoading(true);
      try {
        const vols: any[] = await api.get(`/novels/${projectId}/volumes`);
        const result: VolumeInfo[] = [];
        for (const v of vols) {
          const volNum =
            parseInt((v.name || "").replace("vol-", ""), 10) || 0;
          const data = await api.get(
            `/novels/${projectId}/volumes/${v.filename}`,
          );
          const chapters = (data?.chapters || []).map((ch: any) => ({
            ref: `vol-${volNum}-ch-${ch.chapter}`,
            title: ch.title || `ch-${ch.chapter}`,
          }));
          result.push({ name: v.name, volNum, chapters });
        }
        if (!cancelled) setVolumes(result);
      } catch {
        // volumes may not exist yet
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Fetch prompt files for chapters（chapterRef 时仅拉该章）
  useEffect(() => {
    if (volumes.length === 0) return;
    let cancelled = false;

    async function loadAllPrompts() {
      const allChapters = visibleChapters;

      const newMap: Record<string, ChapterPromptInfo> = {};
      for (const ch of allChapters) {
        try {
          const files: string[] = await api.get(
            `/novels/${projectId}/chapters/${ch.ref}/prompts`,
          );
          const segments: PromptFile[] = files
            .map((f) => {
              const parsed = parsePromptFilename(ch.ref, f);
              if (!parsed) return null;
              return {
                filename: f,
                seg: parsed.segNum,
                title: `段落 ${parsed.segNum}`,
              };
            })
            .filter((s): s is PromptFile => s !== null);

          let status: ChapterPromptInfo["status"] = "none";
          if (segments.length > 0) {
            const anyModified = segments.some((s) =>
              modifiedSegs.has(`${ch.ref}-${s.seg}`),
            );
            status = anyModified ? "modified" : "generated";
          }

          newMap[ch.ref] = {
            chapterRef: ch.ref,
            chapterTitle: ch.title,
            segments,
            status,
          };
        } catch {
          newMap[ch.ref] = {
            chapterRef: ch.ref,
            chapterTitle: ch.title,
            segments: [],
            status: "none",
          };
        }
      }

      if (!cancelled) setChapterPrompts(newMap);
    }

    loadAllPrompts();
    return () => {
      cancelled = true;
    };
  }, [visibleChapters, projectId, modifiedSegs]);

  // =====================================================================
  // Actions
  // =====================================================================

  const handleGenerate = useCallback(
    async (chapterRef: string) => {
      setGeneratingChapters((prev) => new Set(prev).add(chapterRef));
      try {
        await api.post(
          `/novels/${projectId}/chapters/${chapterRef}/prompts/generate`,
        );
        toast.success("提示词生成完成");

        // Reload prompts for this chapter
        const files: string[] = await api.get(
          `/novels/${projectId}/chapters/${chapterRef}/prompts`,
        );
        const segments: PromptFile[] = files
          .map((f) => {
            const parsed = parsePromptFilename(chapterRef, f);
            if (!parsed) return null;
            return {
              filename: f,
              seg: parsed.segNum,
              title: `段落 ${parsed.segNum}`,
            };
          })
          .filter((s): s is PromptFile => s !== null);

        setChapterPrompts((prev) => {
          const existing = prev[chapterRef];
          return {
            ...prev,
            [chapterRef]: {
              chapterRef,
              chapterTitle: existing?.chapterTitle || "",
              segments,
              status: segments.length > 0 ? "generated" : "none",
            },
          };
        });
      } catch (e: any) {
        toast.error(e.message || "生成提示词失败");
      } finally {
        setGeneratingChapters((prev) => {
          const next = new Set(prev);
          next.delete(chapterRef);
          return next;
        });
      }
    },
    [projectId],
  );

  const handleViewPrompt = useCallback(
    async (
      chapterRef: string,
      _seg: number,
      segKey: string,
      title: string,
    ) => {
      setView("viewer");
      setViewerChapterRef(chapterRef);
      setViewerSegKey(segKey);
      setViewerSegTitle(title);
      setViewerLoading(true);
      setViewerError(null);
      setViewerContent("");

      try {
        const text = await fetchPromptText(projectId, chapterRef, segKey);
        setViewerContent(text);
      } catch (e: any) {
        setViewerError(e.message || "获取提示词失败");
      } finally {
        setViewerLoading(false);
      }
    },
    [projectId],
  );

  const handleEdit = useCallback(() => {
    setEditorContent(viewerContent);
    setView("editor");
  }, [viewerContent]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.put(
        `/novels/${projectId}/chapters/${viewerChapterRef}/prompts/${viewerSegKey}`,
        { content: editorContent },
      );
      setViewerContent(editorContent);

      // Track modified
      const segNum = parseInt(viewerSegKey.replace("seg-", ""), 10);
      setModifiedSegs((prev) => new Set(prev).add(`${viewerChapterRef}-${segNum}`));

      // Mark chapter status as modified
      setChapterPrompts((prev) => {
        const ch = prev[viewerChapterRef];
        if (!ch) return prev;
        return { ...prev, [viewerChapterRef]: { ...ch, status: "modified" as const } };
      });

      toast.success("保存成功");
      setView("viewer");
    } catch (e: any) {
      toast.error(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }, [projectId, viewerChapterRef, viewerSegKey, editorContent]);

  const handleCancelEdit = useCallback(() => {
    setView("viewer");
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(viewerContent);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  }, [viewerContent]);

  const handleRestore = useCallback(async () => {
    if (!viewerChapterRef || !viewerSegKey) return;
    setViewerLoading(true);
    try {
      const text = await fetchPromptText(
        projectId,
        viewerChapterRef,
        viewerSegKey,
      );
      setViewerContent(text);

      // Remove modified mark
      const segNum = parseInt(viewerSegKey.replace("seg-", ""), 10);
      setModifiedSegs((prev) => {
        const next = new Set(prev);
        next.delete(`${viewerChapterRef}-${segNum}`);
        return next;
      });

      toast.success("已恢复原始内容");
    } catch (e: any) {
      toast.error(e.message || "恢复失败");
    } finally {
      setViewerLoading(false);
    }
  }, [projectId, viewerChapterRef, viewerSegKey]);

  const handleBackToOverview = useCallback(() => {
    setView("overview");
  }, []);

  const toggleChapter = useCallback((ref: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }, []);

  // =====================================================================
  // Parse prompt content into sections
  // =====================================================================

  const parsedSections = useMemo(() => {
    if (!viewerContent) return [];

    const lines = viewerContent.split("\n");
    const sections: { heading: string; body: string[] }[] = [];
    let currentHeading = "";
    let currentBody: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headingMatch) {
        if (currentHeading || currentBody.length > 0) {
          sections.push({ heading: currentHeading, body: currentBody });
        }
        currentHeading = headingMatch[1].trim();
        currentBody = [];
      } else if (line.trim() === "" && currentBody.length === 0) {
        // skip leading blank lines
      } else {
        currentBody.push(line);
      }
    }
    sections.push({ heading: currentHeading, body: currentBody });

    // If no markdown headings found, split by double newlines
    if (
      sections.length === 1 &&
      !sections[0].heading &&
      sections[0].body.length > 0
    ) {
      const paras = viewerContent.split(/\n\n+/);
      return paras.map((p) => ({
        heading: "",
        body: p.split("\n"),
      }));
    }

    return sections;
  }, [viewerContent]);

  // =====================================================================
  // Render: Overview
  // =====================================================================

  const renderOverview = () => {
    if (overviewLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      );
    }

    const allChapters = visibleChapters;

    if (allChapters.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <FileText className="w-12 h-12 opacity-30 text-base-content/40" />
          <p className="text-base text-base-content/40">
            {volumes.length > 0
              ? "未找到当前章节的提示词"
              : '暂无章节，请先在"正文"中创建章节'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold font-serif text-base-content mb-4">
          提示词管理
        </h2>

        {allChapters.map((ch) => {
          const info = chapterPrompts[ch.ref];
          const segs = info?.segments || [];
          const status = info?.status || "none";

          const statusBadge = (() => {
            switch (status) {
              case "generated":
                return (
                  <span className="badge badge-sm badge-success gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    已生成
                  </span>
                );
              case "partial":
                return (
                  <span className="badge badge-sm badge-warning gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    部分生成
                  </span>
                );
              case "modified":
                return (
                  <span className="badge badge-sm badge-info gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    已修改
                  </span>
                );
              default:
                return (
                  <span className="badge badge-sm badge-ghost gap-1 text-base-content/40">
                    未生成
                  </span>
                );
            }
          })();

          const isExpanded = expandedChapters.has(ch.ref);
          const isGenerating = generatingChapters.has(ch.ref);

          return (
            <div
              key={ch.ref}
              className="border border-base-300/60 rounded-xl bg-base-200/20 overflow-hidden"
            >
              {/* Chapter header */}
              <button
                onClick={() => toggleChapter(ch.ref)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-base-200/40 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-base-content/30 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-base-content/30 flex-shrink-0" />
                )}
                <span className="text-sm font-medium flex-1 truncate">
                  {ch.title}
                </span>
                <span className="text-xs text-base-content/30 mr-2">
                  {segs.length} 段
                </span>
                {statusBadge}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-base-300/40 px-4 py-3 space-y-2">
                  {segs.length > 0 ? (
                    segs.map((seg) => {
                      const isModified = modifiedSegs.has(
                        `${ch.ref}-${seg.seg}`,
                      );
                      return (
                        <div
                          key={seg.filename}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-200/40 transition-colors cursor-pointer group"
                          onClick={() =>
                            handleViewPrompt(
                              ch.ref,
                              seg.seg,
                              `seg-${seg.seg}`,
                              seg.title,
                            )
                          }
                        >
                          <span className="text-xs text-base-content/20 w-6 tabular-nums text-right">
                            {seg.seg}.
                          </span>
                          <span className="text-sm flex-1 truncate">
                            {seg.title}
                          </span>
                          {isModified && (
                            <span className="badge badge-xs badge-info">
                              已修改
                            </span>
                          )}
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-3.5 h-3.5 text-base-content/30" />
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-base-content/30 py-2 text-center">
                      暂无提示词
                    </p>
                  )}

                  {/* Generate button */}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerate(ch.ref);
                      }}
                      disabled={isGenerating}
                      className="px-3 py-1.5 text-xs rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {isGenerating ? "生成中…" : "生成提示词"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // =====================================================================
  // Render: Viewer
  // =====================================================================

  const renderViewer = () => {
    const segNum = parseInt(viewerSegKey.replace("seg-", ""), 10);
    const isModified = modifiedSegs.has(`${viewerChapterRef}-${segNum}`);

    return (
      <div className="space-y-4">
        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBackToOverview}
            className="px-3 py-1.5 text-sm rounded-lg border border-base-300/60 text-base-content/60 hover:text-base-content hover:border-base-300 transition-colors inline-flex items-center gap-1.5"
          >
            <Undo2 className="w-3.5 h-3.5" />
            返回
          </button>
          <div className="flex-1" />
          <span className="text-sm text-base-content/60">
            {viewerSegTitle}
          </span>
          <div className="h-4 w-px bg-base-300/40" />
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs rounded-lg border border-base-300/60 text-base-content/60 hover:text-base-content hover:border-base-300 transition-colors inline-flex items-center gap-1.5"
          >
            <Copy className="w-3 h-3" />
            复制全文
          </button>
          {isModified && (
            <button
              onClick={handleRestore}
              className="px-3 py-1.5 text-xs rounded-lg border border-warning/30 text-warning/70 hover:text-warning hover:border-warning/50 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              恢复原始
            </button>
          )}
          <button
            onClick={handleEdit}
            className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1.5"
          >
            <Edit3 className="w-3 h-3" />
            编辑
          </button>
        </div>

        {/* Content area */}
        {viewerLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : viewerError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm text-error/70">{viewerError}</p>
            <button
              onClick={() =>
                handleViewPrompt(
                  viewerChapterRef,
                  segNum,
                  viewerSegKey,
                  viewerSegTitle,
                )
              }
              className="text-xs text-primary/60 hover:text-primary"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {parsedSections.map((section, i) => (
              <div
                key={i}
                className="border border-base-300/50 rounded-xl overflow-hidden"
              >
                {section.heading && (
                  <div className="px-4 py-2 bg-base-200/30 border-b border-base-300/30">
                    <h3 className="text-sm font-semibold text-base-content/80">
                      {section.heading}
                    </h3>
                  </div>
                )}
                <div className="px-4 py-3">
                  <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-base-content/80">
                    {section.body.join("\n")}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // =====================================================================
  // Render: Editor
  // =====================================================================

  const renderEditor = () => {
    return (
      <div className="space-y-4">
        {/* Action bar */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-base-content">
            {viewerSegTitle} - 编辑
          </span>
          <div className="flex-1" />
          <button
            onClick={handleCancelEdit}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-lg border border-base-300/60 text-base-content/60 hover:text-base-content hover:border-base-300 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <X className="w-3 h-3" />
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saving ? "保存中…" : "保存"}
          </button>
        </div>

        {/* Textarea */}
        <textarea
          className="w-full h-[calc(100vh-16rem)] min-h-[400px] bg-base-200/30 border border-base-300/60 rounded-xl px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40 focus:bg-base-200/50 resize-y font-mono"
          value={editorContent}
          onChange={(e) => setEditorContent(e.target.value)}
        />
      </div>
    );
  };

  // =====================================================================
  // Main render
  // =====================================================================

  return (
    <div className="p-6">
      {view === "overview" && renderOverview()}
      {view === "viewer" && renderViewer()}
      {view === "editor" && renderEditor()}
    </div>
  );
}
