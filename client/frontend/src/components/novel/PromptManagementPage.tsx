// 提示词管理（章手风琴 + 分段提示词查看/编辑）。PR 5 轻重皮：
// daisyUI/lucide 全部换 design 类与图标注册表；「生成段落提示词」措辞
// 按 spec-review #9（与章级提示词区分）。
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ico, P } from "@/components/icons";
import { api, request } from "@/lib/api";
import { toast } from "@/lib/toast";
import { getToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/env";

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
  status: "generated" | "none" | "modified";
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
  // 未配 AI Key（prompts 端点 503）：就地提示 + 去配置，不再整页跳 /config
  const [aiUnavailable, setAiUnavailable] = useState(false);
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
        // change 006：GET /volumes 返回 DB 全量树（卷含 ref + chapters 元数据），
        // 卷章一次到位，无需逐卷二次请求。旧形状按 v.name/v.filename 读 →
        // filename 为 undefined → /volumes/undefined 404 → 空态「暂无章节」。
        const vols: any[] = await api.get(`/novels/${projectId}/volumes`);
        const result: VolumeInfo[] = vols.map((v) => {
          const volNum =
            parseInt((v.ref || "").replace("vol-", ""), 10) || 0;
          const chapters = (v.chapters || []).map((ch: any) => ({
            ref: ch.ref,
            title: ch.title || `ch-${ch.chapter}`,
          }));
          return { name: v.ref, volNum, chapters };
        });
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
      setAiUnavailable(false);

      const newMap: Record<string, ChapterPromptInfo> = {};
      for (const ch of allChapters) {
        try {
          const files: string[] = await request(
            `/novels/${projectId}/chapters/${ch.ref}/prompts`,
            { soft503: true },
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
        } catch (e: any) {
          // 503 = 会员但未配 AI Key：就地提示并终止加载（其余章必然同样 503）
          if (e?.status === 503) {
            if (!cancelled) setAiUnavailable(true);
            return;
          }
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
        const files: string[] = await request(
          `/novels/${projectId}/chapters/${chapterRef}/prompts`,
          { soft503: true },
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
        toast.error(e.message || "生成段落提示词失败");
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
        <div className="pm-loading">
          <Ico d={P.spinner} className="spin" size={18} style={{ color: "var(--accent)" }} />
        </div>
      );
    }

    // 未配 AI Key：提示词读写全链路不可用 → 就地引导配置（不整页跳转）
    if (aiUnavailable) {
      return (
        <div className="pm-empty">
          <Ico d={P.lock} size={28} style={{ color: "var(--muted)" }} />
          <div className="pm-empty-text">
            <p>尚未配置模型 API Key</p>
            <p className="sub">
              提示词的生成与查看需要 AI 能力，请先配置 API Key 后再使用。
            </p>
          </div>
          <a href="#/config" className="btn btn-primary btn-sm">
            去配置
          </a>
        </div>
      );
    }

    const allChapters = visibleChapters;

    if (allChapters.length === 0) {
      return (
        <div className="pm-empty">
          <Ico d={P.doc} size={28} style={{ color: "var(--muted)" }} />
          <p className="pm-empty-text">
            {volumes.length > 0
              ? "未找到当前章节的提示词"
              : '暂无章节，请先在"正文"中创建章节'}
          </p>
        </div>
      );
    }

    return (
      <div>
        <h2 className="serif pm-h2">提示词管理</h2>

        {allChapters.map((ch) => {
          const info = chapterPrompts[ch.ref];
          const segs = info?.segments || [];
          const status = info?.status || "none";

          const statusBadge =
            status === "generated" ? (
              <span className="badge ok">
                <Ico d={P.check} sw={2.6} size={10} />
                已生成
              </span>
            ) : status === "modified" ? (
              <span className="badge warn">
                <Ico d={P.dot} fill size={10} />
                已修改
              </span>
            ) : (
              <span className="badge empty">未生成</span>
            );

          const isExpanded = expandedChapters.has(ch.ref);
          const isGenerating = generatingChapters.has(ch.ref);

          return (
            <div key={ch.ref} className="pm-card">
              {/* Chapter header */}
              <button onClick={() => toggleChapter(ch.ref)} className="pm-head">
                <Ico
                  d={isExpanded ? P.chevronDown : P.chevronRight}
                  sw={1.8}
                  size={14}
                  style={{ color: "var(--muted)", flex: "none" }}
                />
                <span className="pm-title">{ch.title}</span>
                <span className="cnt" style={{ marginRight: 6 }}>
                  {segs.length} 段
                </span>
                {statusBadge}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="pm-body">
                  {segs.length > 0 ? (
                    segs.map((seg) => {
                      const isModified = modifiedSegs.has(
                        `${ch.ref}-${seg.seg}`,
                      );
                      return (
                        <div
                          key={seg.filename}
                          className="pm-row"
                          onClick={() =>
                            handleViewPrompt(
                              ch.ref,
                              seg.seg,
                              `seg-${seg.seg}`,
                              seg.title,
                            )
                          }
                        >
                          <span className="idx">{seg.seg}.</span>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {seg.title}
                          </span>
                          {isModified && (
                            <span className="badge warn">已修改</span>
                          )}
                          <Ico d={P.eye} size={14} style={{ color: "var(--muted)" }} />
                        </div>
                      );
                    })
                  ) : (
                    <p className="pm-none">暂无提示词</p>
                  )}

                  {/* Generate button */}
                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerate(ch.ref);
                      }}
                      disabled={isGenerating}
                      className="btn btn-secondary btn-sm"
                    >
                      {isGenerating ? (
                        <Ico d={P.spinner} className="spin" size={12} />
                      ) : (
                        <Ico d={P.spark} size={12} />
                      )}
                      {isGenerating ? "生成中…" : "生成段落提示词"}
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
      <div>
        {/* Action bar */}
        <div className="pm-bar">
          <button onClick={handleBackToOverview} className="btn btn-ghost btn-sm">
            <Ico d={P.back} sw={1.8} size={13} />
            返回
          </button>
          <span className="grow" />
          <span className="cnt">{viewerSegTitle}</span>
          <span className="tsep" />
          <button onClick={handleCopy} className="btn btn-secondary btn-sm">
            <Ico d={P.copy} size={13} />
            复制全文
          </button>
          {isModified && (
            <button onClick={handleRestore} className="btn btn-secondary btn-sm">
              <Ico d={P.refresh} size={13} />
              恢复原始
            </button>
          )}
          <button onClick={handleEdit} className="btn btn-primary btn-sm">
            <Ico d={P.pencil} size={13} />
            编辑
          </button>
        </div>

        {/* Content area */}
        {viewerLoading ? (
          <div className="pm-loading">
            <Ico d={P.spinner} className="spin" size={18} style={{ color: "var(--accent)" }} />
          </div>
        ) : viewerError ? (
          <div className="pm-empty">
            <p style={{ color: "var(--err)", fontSize: 13 }}>{viewerError}</p>
            <button
              onClick={() =>
                handleViewPrompt(
                  viewerChapterRef,
                  segNum,
                  viewerSegKey,
                  viewerSegTitle,
                )
              }
              className="btn btn-ghost btn-sm"
            >
              重试
            </button>
          </div>
        ) : (
          <div>
            {parsedSections.map((section, i) => (
              <div key={i} className="pm-sec" style={{ marginBottom: 10 }}>
                {section.heading && <h3>{section.heading}</h3>}
                <pre>{section.body.join("\n")}</pre>
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
      <div>
        {/* Action bar */}
        <div className="pm-bar">
          <span className="pm-bar-title">{viewerSegTitle} · 编辑</span>
          <span className="grow" />
          <button onClick={handleCancelEdit} disabled={saving} className="btn btn-secondary btn-sm">
            <Ico d={P.close} size={13} />
            取消
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? (
              <Ico d={P.spinner} className="spin" size={12} />
            ) : (
              <Ico d={P.check} size={13} />
            )}
            {saving ? "保存中…" : "保存"}
          </button>
        </div>

        {/* Textarea */}
        <textarea
          className="ai-prompt"
          style={{ height: "calc(100vh - 16rem)", minHeight: 400 }}
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
    <div className="prompt-mgmt">
      {view === "overview" && renderOverview()}
      {view === "viewer" && renderViewer()}
      {view === "editor" && renderEditor()}
    </div>
  );
}
