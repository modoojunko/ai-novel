"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Archive,
  ChevronRight,
  FileText,
  Copy,
} from "lucide-react";

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

  const chapterRefs: string[] = [];
  volumes.forEach((v) => {
    (v.chapters || []).forEach((ch: any) => {
      chapterRefs.push(`vol-${ch.volume}-ch-${ch.chapter}`);
    });
  });

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Writing Studio</h2>

      <div className="grid grid-cols-12 gap-4">
        {/* Left rail */}
        <div className="col-span-2">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Chapters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              {chapterRefs.map((ref) => (
                <Button
                  key={ref}
                  variant={selectedRef === ref ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => selectChapter(ref)}
                >
                  <ChevronRight className="w-3 h-3 mr-1" />
                  {ref}
                </Button>
              ))}
              {chapterRefs.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">No chapters with prompts yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center: segments */}
        <div className="col-span-7">
          {!selectedRef ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a chapter to start writing
            </div>
          ) : segments.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              This chapter has no segments. Generate prompts first.
            </div>
          ) : (
            <div className="space-y-4">
              {segments.map((seg) => (
                <Card key={seg.idx}>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-medium">
                        Seg {seg.idx}: {seg.title}
                      </CardTitle>
                      {seg.status === "streaming" && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                      {seg.status === "done" && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {seg.status === "streaming" && (
                        <Button variant="outline" size="sm" onClick={() => stopStream(seg.idx)}>
                          <Pause className="w-3 h-3 mr-1" /> Stop
                        </Button>
                      )}
                      {(seg.status === "idle" || seg.status === "paused") && (
                        <Button size="sm" onClick={() => startStream(seg.idx)}>
                          <Play className="w-3 h-3 mr-1" />
                          {seg.status === "paused" ? "Resume" : "Generate"}
                        </Button>
                      )}
                      {seg.status === "done" && (
                        <Button variant="outline" size="sm" onClick={() => startStream(seg.idx)}>
                          <RotateCcw className="w-3 h-3 mr-1" /> Regenerate
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48 rounded border bg-muted/30 p-3">
                      {seg.text ? (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{seg.text}</p>
                      ) : (
                        <p className="text-sm text-gray-300 italic">
                          {seg.status === "streaming"
                            ? "Generating..."
                            : "Click Generate to start writing this segment."}
                        </p>
                      )}
                    </ScrollArea>
                    {seg.violations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {seg.violations.map((v, i) => (
                          <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right rail: actions + quality */}
        <div className="col-span-3 space-y-4">
          {selectedRef && (
            <>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={runQualityCheck}
                    disabled={!segments.some((s) => s.status === "done")}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Quality Check
                  </Button>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={doArchive}
                    disabled={!allDone || archiving}
                  >
                    {archiving ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Archive className="w-3 h-3 mr-1" />
                    )}
                    Archive Chapter
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Stats</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1 text-muted-foreground">
                  <div>Segments: {segments.length}</div>
                  <div>Completed: {segments.filter((s) => s.status === "done").length}</div>
                  <div>Tokens: {totalTokens.toLocaleString()}</div>
                  <div className={totalViolations > 0 ? "text-red-500 font-medium" : ""}>
                    Violations: {totalViolations}
                  </div>
                </CardContent>
              </Card>

              {qcResult && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Quality Check</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {qcResult.passed ? (
                      <p className="text-sm text-primary font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> All checks passed
                      </p>
                    ) : (
                      <p className="text-sm text-red-600 font-medium">Issues found</p>
                    )}
                    {qcResult.checks &&
                      Object.entries(qcResult.checks).map(([key, check]: [string, any]) => (
                        <div key={key} className="text-xs flex items-center justify-between">
                          <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                          <span className={check.passed ? "text-primary" : "text-red-500"}>
                            {check.passed ? "PASS" : "FAIL"}
                          </span>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}

              {fullText && allDone && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Full Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => navigator.clipboard.writeText(fullText)}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy All ({fullText.length} chars)
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
