"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiSuggestButton } from "@/components/ui/ai-suggest-button";
import { ChapterTree, parseChapterRefs } from "@/components/project/ChapterTree";
import { toast } from "@/lib/toast";
import {
  Save,
  Loader2,
  Send,
  Trash2,
} from "lucide-react";

type Segment = {
  seg: number;
  focus: string;
  emotion: string;
  key_beat: string;
  characters: string[];
  location: string;
  time: string;
  target_words: number;
};

type Chapter = {
  volume: number;
  chapter: number;
  title: string;
  pov_character: string;
  thread: string;
  story_time: string;
  concurrent_with: string;
  crossover_ref: string;
  outline: {
    summary: string;
    perspective_guidance: string;
    segments: Segment[];
  };
  memo: {
    to_avoid: string;
    notes: string;
  };
  status: string;
};

type Volume = {
  filename: string;
  name: string;
  chapters: Chapter[];
};

function emptyChapter(vol: number, ch: number): Chapter {
  return {
    volume: vol,
    chapter: ch,
    title: "",
    pov_character: "",
    thread: "",
    story_time: "",
    concurrent_with: "",
    crossover_ref: "",
    outline: { summary: "", perspective_guidance: "", segments: [] },
    memo: { to_avoid: "", notes: "" },
    status: "outlining",
  };
}

function emptySegment(segNum: number): Segment {
  return {
    seg: segNum,
    focus: "",
    emotion: "",
    key_beat: "",
    characters: [],
    location: "",
    time: "",
    target_words: 1500,
  };
}

export default function OutlinePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [projectId, setProjectId] = useState("");
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [volTitle, setVolTitle] = useState("");
  const [showAdvFields, setShowAdvFields] = useState(false);
  const [showCreateVol, setShowCreateVol] = useState(false);

  const loadVolumes = useCallback(async () => {
    if (!projectId) return;
    const vols = await api.get(`/projects/${projectId}/volumes`);
    const withChapters: Volume[] = await Promise.all(
      vols.map(async (v: any) => {
        const data = await api.get(`/projects/${projectId}/volumes/${v.filename}`);
        return { ...v, chapters: data?.chapters || [] };
      })
    );
    setVolumes(withChapters);
  }, [projectId]);

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  useEffect(() => {
    loadVolumes();
  }, [loadVolumes]);

  async function createVolume() {
    const title = volTitle.trim() || `Volume ${volumes.length + 1}`;
    await api.post(`/projects/${projectId}/volumes`, {
      vol_num: volumes.length + 1,
      title,
    });
    setVolTitle("");
    loadVolumes();
  }

  async function addChapter(volNum: number) {
    const chNum =
      (volumes.find((v) => v.name === `vol-${volNum}`)?.chapters?.length || 0) + 1;
    const ch = emptyChapter(volNum, chNum);
    await api.put(`/projects/${projectId}/chapters/vol-${volNum}-ch-${chNum}`, ch);
    setEditingChapter(ch);
    loadVolumes();
  }

  async function saveChapter() {
    if (!editingChapter) return;
    setSaving(true);
    const ref = `vol-${editingChapter.volume}-ch-${editingChapter.chapter}`;
    await api.put(`/projects/${projectId}/chapters/${ref}`, editingChapter);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    loadVolumes();
  }

  function updateChapterField(field: string, value: any) {
    if (!editingChapter) return;
    const keys = field.split(".");
    const copy = { ...editingChapter };
    if (keys.length === 1) {
      (copy as any)[keys[0]] = value;
    } else {
      (copy as any)[keys[0]][keys[1]] = value;
    }
    setEditingChapter(copy);
  }

  function addSegment() {
    if (!editingChapter) return;
    const segs = [...(editingChapter.outline?.segments || [])];
    segs.push(emptySegment(segs.length + 1));
    updateChapterField("outline.segments", segs);
  }

  function updateSegment(idx: number, field: string, value: any) {
    if (!editingChapter) return;
    const segs = [...(editingChapter.outline?.segments || [])];
    (segs[idx] as any)[field] = value;
    updateChapterField("outline.segments", segs);
  }

  function removeSegment(idx: number) {
    if (!editingChapter) return;
    const segs = editingChapter.outline?.segments?.filter((_, i) => i !== idx) || [];
    updateChapterField("outline.segments", segs);
  }

  async function confirmChapter(ref: string) {
    await api.post(`/projects/${projectId}/chapters/${ref}/confirm`);
    loadVolumes();
  }

  function toggleVol(name: string) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  const { volumes: treeVolumes } = parseChapterRefs(volumes);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-[family-name:var(--font-serif-heading)]">大纲</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Volume/Chapter tree */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground">卷·章结构</span>
            <Button size="sm" onClick={() => setShowCreateVol(true)}>
              + 新卷
            </Button>
          </div>

          <ChapterTree
            volumes={treeVolumes}
            selectedRef={editingChapter ? `vol-${editingChapter.volume}-ch-${editingChapter.chapter}` : null}
            onSelect={(ref) => {
              const ch = volumes
                .flatMap((v: any) => (v.chapters || []).map((c: any) => c))
                .find((c: any) => `vol-${c.volume}-ch-${c.chapter}` === ref);
              if (ch) setEditingChapter(ch);
            }}
            expanded={expanded}
            onToggle={toggleVol}
          />

          {volumes.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">暂无卷章，点击「新卷」开始</p>
          )}
        </div>

        {/* Right: Chapter editor */}
        <div>
          {editingChapter ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      vol-{editingChapter.volume} ch-{editingChapter.chapter}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => confirmChapter(`vol-${editingChapter.volume}-ch-${editingChapter.chapter}`)}>
                        <Send className="w-3 h-3 mr-1" /> 确认
                      </Button>
                      <Button size="sm" onClick={saveChapter} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                        {saved ? "已保存" : "保存"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">章节标题</label>
                      <AiSuggestButton onClick={() => toast.info("即将上线")} />
                    </div>
                    <Input
                      value={editingChapter.title}
                      onChange={(e) => updateChapterField("title", e.target.value)}
                      placeholder="输入章节标题..."
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">章节概要</label>
                      <AiSuggestButton onClick={() => toast.info("即将上线")} />
                    </div>
                    <Textarea
                      rows={4}
                      value={editingChapter.outline?.summary || ""}
                      onChange={(e) => updateChapterField("outline.summary", e.target.value)}
                      placeholder="概述这一章的核心内容..."
                    />
                  </div>

                  {/* Advanced fields — collapsible text link */}
                  <div className="border border-border rounded-lg">
                    <button
                      type="button"
                      onClick={() => setShowAdvFields(!showAdvFields)}
                      className="flex items-center justify-between w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>更多字段</span>
                      <span className="text-[10px]">
                        {showAdvFields ? "▾ POV、线索、时间线" : "▸ POV、线索、时间线"}
                      </span>
                    </button>
                    {showAdvFields && (
                      <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-muted-foreground">POV 角色</label>
                            <Input
                              className="mt-0.5"
                              value={editingChapter.pov_character || ""}
                              onChange={(e) => updateChapterField("pov_character", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground">故事线索</label>
                            <Input
                              className="mt-0.5"
                              value={editingChapter.thread || ""}
                              onChange={(e) => updateChapterField("thread", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground">故事时间</label>
                            <Input
                              className="mt-0.5"
                              value={editingChapter.story_time || ""}
                              onChange={(e) => updateChapterField("story_time", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground">并线章节</label>
                            <Input
                              className="mt-0.5"
                              value={editingChapter.concurrent_with || ""}
                              onChange={(e) => updateChapterField("concurrent_with", e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground">Memo: 避免事项</label>
                          <Input
                            className="mt-0.5"
                            value={editingChapter.memo?.to_avoid || ""}
                            onChange={(e) => updateChapterField("memo.to_avoid", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground">Memo: 备注</label>
                          <Input
                            className="mt-0.5"
                            value={editingChapter.memo?.notes || ""}
                            onChange={(e) => updateChapterField("memo.notes", e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Segments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-sm">段落划分</CardTitle>
                  <Button variant="outline" size="sm" onClick={addSegment}>
                    + 添加段落
                  </Button>
                </CardHeader>
                <CardContent className="space-y-1">
                  {(editingChapter.outline?.segments || []).map((seg: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/30 group">
                      <span className="text-[10px] text-muted-foreground w-4">{seg.seg || i + 1}</span>
                      <Input
                        className="flex-1 h-7 text-xs"
                        placeholder="段落主题..."
                        value={seg.focus || ""}
                        onChange={(e) => updateSegment(i, "focus", e.target.value)}
                      />
                      <Input
                        className="w-20 h-7 text-xs"
                        type="number"
                        placeholder="字数"
                        value={seg.target_words || 1500}
                        onChange={(e) => updateSegment(i, "target_words", Number(e.target.value))}
                      />
                      <button
                        onClick={() => removeSegment(i)}
                        className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              选择左侧章节开始编辑
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCreateVol} onOpenChange={setShowCreateVol}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-serif-heading)]">
              创建新卷
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              placeholder="卷标题..."
              value={volTitle}
              onChange={(e) => setVolTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (createVolume(), setShowCreateVol(false))}
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowCreateVol(false)}>取消</Button>
              <Button onClick={() => { createVolume(); setShowCreateVol(false); }} disabled={volumes.length >= 9}>
                创建卷
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
