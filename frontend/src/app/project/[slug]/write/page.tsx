"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Archive,
  Copy,
} from "lucide-react";
import { ChapterTree, parseChapterRefs } from "@/components/project/ChapterTree";

type SegState = {
  idx: number;
  title: string;
  text: string;
  status: "idle" | "streaming" | "paused" | "done";
  violations: string[];
  tokens: number;
};

export default function WritePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [volumes, setVolumes] = useState<any[]>([]);
  const [selectedRef, setSelectedRef] = useState("");
  const [chapter, setChapter] = useState<any>(null);
  const [segments, setSegments] = useState<SegState[]>([]);
  const [qcResult, setQcResult] = useState<any>(null);
  const [archiving, setArchiving] = useState(false);
  const abortRef = useRef<Record<number, AbortController>>({});
  const [expandedVols, setExpandedVols] = useState<Record<string, boolean>>({});
  const [showQc, setShowQc] = useState(false);

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  const loadVolumes = useCallback(async () => {
    if (!projectId) return;
    const vols = await api.get(`/projects/${projectId}/volumes`);
    const withChapters: any[] = [];
    for (const v of vols) {
      const data = await api.get(`/projects/${projectId}/volumes/${v.filename}`);
      withChapters.push({ ...v, chapters: data?.chapters || [] });
    }
    setVolumes(withChapters);
  }, [projectId]);

  useEffect(() => {
    loadVolumes();
  }, [loadVolumes]);

  async function selectChapter(ref: string) {
    setSelectedRef(ref);
    setSegments([]);
    setQcResult(null);
    const ch = await api.get(`/projects/${projectId}/chapters/${ref}`);
    setChapter(ch);
    const segs = (ch?.outline?.segments || []).map((s: any, i: number) => ({
      idx: i + 1,
      title: s.focus?.slice(0, 40) || `Segment ${i + 1}`,
      text: "",
      status: "idle" as const,
      violations: [],
      tokens: 0,
    }));
    setSegments(segs);
  }

  function startStream(segIdx: number) {
    if (!selectedRef) return;
    const controller = new AbortController();
    abortRef.current[segIdx] = controller;

    setSegments((prev) =>
      prev.map((s) => (s.idx === segIdx ? { ...s, text: "", violations: [], status: "streaming" } : s))
    );

    const url = `/api/projects/${projectId}/chapters/${selectedRef}/write/stream/${segIdx}`;
    fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok || !res.body) throw new Error("Stream failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) return;
            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
              if (!part.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(part.slice(6));
                if (data.type === "chunk" || data.type === "violation") {
                  setSegments((prev) =>
                    prev.map((s) =>
                      s.idx === segIdx
                        ? {
                            ...s,
                            text: s.text + data.text,
                            violations: data.violations?.length
                              ? [...s.violations, ...data.violations]
                              : s.violations,
                          }
                        : s
                    )
                  );
                } else if (data.type === "done") {
                  setSegments((prev) =>
                    prev.map((s) =>
                      s.idx === segIdx
                        ? { ...s, status: "done", tokens: data.total_tokens || 0 }
                        : s
                    )
                  );
                }
              } catch { /* partial JSON */ }
            }
            return pump();
          });
        }
        return pump();
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setSegments((prev) =>
            prev.map((s) =>
              s.idx === segIdx
                ? { ...s, status: "idle", text: `Error: ${err.message}` }
                : s
            )
          );
        }
      });
  }

  function stopStream(segIdx: number) {
    abortRef.current[segIdx]?.abort();
    setSegments((prev) =>
      prev.map((s) => (s.idx === segIdx ? { ...s, status: "paused" } : s))
    );
  }

  async function runQualityCheck() {
    const fullText = segments.map((s) => s.text).join("\n\n---\n\n");
    const result = await api.post(
      `/projects/${projectId}/chapters/${selectedRef}/write/quality-check`,
      { full_text: fullText }
    );
    setQcResult(result);
  }

  async function doArchive() {
    setArchiving(true);
    const fullText = segments.map((s) => s.text).join("\n\n---\n\n");
    await api.post(`/projects/${projectId}/chapters/${selectedRef}/archive`, {
      full_text: fullText,
    });
    setArchiving(false);
    router.push(`/project/${slug}/archives`);
  }

  const allDone = segments.length > 0 && segments.every((s) => s.status === "done");
  const fullText = segments.map((s) => s.text).join("\n\n---\n\n");
  const totalViolations = segments.reduce((acc, s) => acc + s.violations.length, 0);
  const totalTokens = segments.reduce((acc, s) => acc + s.tokens, 0);

  const { volumes: treeVolumes, chapterRefs } = parseChapterRefs(volumes);

  return (
    <div className="flex h-[calc(100vh-120px)] relative">
      {/* Left: Chapter tree */}
      <div className="w-[220px] flex-shrink-0 border-r border-border p-3 overflow-y-auto">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">卷·章</span>
        <div className="mt-2">
          <ChapterTree
            volumes={treeVolumes}
            selectedRef={selectedRef}
            onSelect={selectChapter}
            expanded={expandedVols}
            onToggle={(name) => setExpandedVols((p) => ({ ...p, [name]: !p[name] }))}
          />
          {chapterRefs.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">暂无章节</p>
          )}
        </div>
      </div>

      {/* Center: prose flow */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedRef ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            选择左侧章节开始写作
          </div>
        ) : segments.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            本章暂无段落。先生成提示词。
          </div>
        ) : (
          <>
            {/* Chapter header */}
            <div className="px-8 py-5 border-b border-border">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground">
                    vol-{chapter?.volume} · ch-{chapter?.chapter}
                  </span>
                  <h3 className="text-xl font-[family-name:var(--font-serif-heading)] text-foreground mt-1">
                    {chapter?.title || selectedRef}
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">{totalTokens.toLocaleString()} tokens</span>
              </div>
              {/* Segment progress dots */}
              <div className="flex items-center gap-[5px] mt-3">
                {segments.map((seg) => (
                  <div
                    key={seg.idx}
                    className={`w-[7px] h-[7px] rounded-full ${
                      seg.status === "done"
                        ? "bg-emerald-600"
                        : seg.status === "streaming"
                          ? "bg-primary shadow-[0_0_5px_var(--primary)]"
                          : "border border-muted-foreground/30"
                    }`}
                  />
                ))}
                <span className="text-[10px] text-muted-foreground ml-2">
                  {segments.filter((s) => s.status === "done").length}/{segments.length} segments
                </span>
              </div>
            </div>

            {/* Segment flow */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-0">
              {segments.map((seg) => (
                <div
                  key={seg.idx}
                  className={`pb-6 mb-6 ${
                    seg.status === "streaming"
                      ? "border-l-[2px] border-primary pl-4 -ml-[2px] bg-primary/[0.02] rounded-r-lg"
                      : seg.status === "idle" || seg.status === "paused"
                        ? "border-l-[1px] border-dashed border-muted-foreground/20 pl-4 -ml-[1px]"
                        : "border-l-[2px] border-transparent pl-4 -ml-[2px]"
                  }`}
                >
                  {/* Segment header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${
                        seg.status === "done"
                          ? "bg-emerald-600"
                          : seg.status === "streaming"
                            ? "bg-primary shadow-[0_0_4px_var(--primary)]"
                            : "border border-muted-foreground/30"
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        seg.status === "done"
                          ? "text-emerald-600/70"
                          : seg.status === "streaming"
                            ? "text-primary"
                            : "text-muted-foreground/40"
                      }`}
                    >
                      seg {seg.idx} · {seg.title}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {seg.status === "streaming" && (
                        <button
                          onClick={() => stopStream(seg.idx)}
                          className="text-[10px] text-primary border border-primary rounded px-2 py-0.5 hover:bg-primary/10 transition-colors"
                        >
                          暂停
                        </button>
                      )}
                      {(seg.status === "idle" || seg.status === "paused") && (
                        <button
                          onClick={() => startStream(seg.idx)}
                          className="text-[10px] text-primary border border-primary/40 rounded px-2 py-0.5 hover:bg-primary/10 transition-colors"
                        >
                          生成
                        </button>
                      )}
                      {seg.status === "done" && (
                        <button
                          onClick={() => startStream(seg.idx)}
                          className="text-[10px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                        >
                          重生成
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Prose text */}
                  {seg.text ? (
                    <p
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        seg.status === "done"
                          ? "font-[family-name:var(--font-serif-heading)] text-foreground"
                          : "text-foreground/80"
                      }`}
                    >
                      {seg.text}
                      {seg.status === "streaming" && (
                        <span className="inline-block w-[2px] h-[1em] bg-primary align-text-bottom animate-pulse ml-0.5" />
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/30 italic">
                      {seg.status === "streaming" ? "生成中..." : "点击「生成」开始写作"}
                    </p>
                  )}

                  {/* Violations */}
                  {seg.violations && seg.violations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {seg.violations.map((v: string, i: number) => (
                        <span key={i} className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right: slide-in QC panel */}
      {showQc && selectedRef && (
        <div className="w-[260px] flex-shrink-0 border-l border-border p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">质量检查</span>
            <button onClick={() => setShowQc(false)} className="text-muted-foreground hover:text-foreground">
              <span className="text-sm">✕</span>
            </button>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={runQualityCheck}
              disabled={!segments.some((s) => s.status === "done")}
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              运行质量检查
            </Button>

            <Button
              size="sm"
              className="w-full justify-start"
              onClick={doArchive}
              disabled={!allDone || archiving}
            >
              {archiving ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Archive className="w-3 h-3 mr-1" />
              )}
              存档本章
            </Button>

            <div className="text-[11px] space-y-1 text-muted-foreground pt-2 border-t border-border">
              <div className="flex justify-between">
                <span>段落数</span>
                <span>{segments.length}</span>
              </div>
              <div className="flex justify-between">
                <span>已完成</span>
                <span>{segments.filter((s) => s.status === "done").length}</span>
              </div>
              <div className="flex justify-between">
                <span>Tokens</span>
                <span>{totalTokens.toLocaleString()}</span>
              </div>
              <div className={`flex justify-between ${totalViolations > 0 ? "text-destructive" : ""}`}>
                <span>违规项</span>
                <span>{totalViolations}</span>
              </div>
            </div>

            {qcResult && (
              <div className="space-y-1 pt-2 border-t border-border">
                {qcResult.passed ? (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 全部通过
                  </p>
                ) : (
                  <p className="text-xs text-destructive font-medium">发现问题</p>
                )}
                {qcResult.checks &&
                  Object.entries(qcResult.checks).map(([key, check]: [string, any]) => (
                    <div key={key} className="text-[10px] flex items-center justify-between">
                      <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                      <span className={check.passed ? "text-emerald-600" : "text-destructive"}>
                        {check.passed ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {fullText && allDone && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => navigator.clipboard.writeText(fullText)}
              >
                <Copy className="w-3 h-3 mr-1" /> 复制全文 ({fullText.length} 字)
              </Button>
            )}
          </div>
        </div>
      )}

      {/* QC toggle button (shown when panel hidden) */}
      {selectedRef && !showQc && (
        <div className="absolute right-4 top-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQc(true)}
          >
            质量检查
          </Button>
        </div>
      )}
    </div>
  );
}
