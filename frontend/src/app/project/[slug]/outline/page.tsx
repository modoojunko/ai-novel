"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Outline Board</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Volume/Chapter tree */}
        <div>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New volume title..."
              value={volTitle}
              onChange={(e) => setVolTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createVolume()}
            />
            <Button onClick={createVolume} disabled={volumes.length >= 9}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {volumes.map((vol) => {
              const volNum = vol.name.replace("vol-", "");
              const isOpen = expanded[vol.name] !== false;
              return (
                <Card key={vol.name}>
                  <CardHeader
                    className="cursor-pointer py-3"
                    onClick={() => toggleVol(vol.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <CardTitle className="text-base">{vol.name}</CardTitle>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          addChapter(Number(volNum));
                        }}
                      >
                        + Chapter
                      </Button>
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent className="pt-0 space-y-1">
                      {vol.chapters?.map((ch) => {
                        const ref = `vol-${ch.volume}-ch-${ch.chapter}`;
                        return (
                          <div
                            key={ref}
                            className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50 cursor-pointer text-sm"
                            onClick={() => setEditingChapter(ch)}
                          >
                            <span>
                              ch-{ch.chapter} {ch.title || "(untitled)"}
                            </span>
                            <div className="flex items-center gap-1">
                              {ch.status === "confirmed" && (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmChapter(ref);
                                }}
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right: Chapter editor */}
        <div>
          {editingChapter ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    vol-{editingChapter.volume} ch-{editingChapter.chapter}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium">Title</label>
                    <Input
                      value={editingChapter.title}
                      onChange={(e) => updateChapterField("title", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium">POV Character</label>
                      <Input
                        value={editingChapter.pov_character}
                        onChange={(e) => updateChapterField("pov_character", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Thread</label>
                      <Input
                        value={editingChapter.thread}
                        onChange={(e) => updateChapterField("thread", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Story Time</label>
                      <Input
                        value={editingChapter.story_time}
                        onChange={(e) => updateChapterField("story_time", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Concurrent With</label>
                      <Input
                        value={editingChapter.concurrent_with}
                        onChange={(e) => updateChapterField("concurrent_with", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Outline Summary</label>
                    <Textarea
                      rows={4}
                      value={editingChapter.outline?.summary || ""}
                      onChange={(e) =>
                        updateChapterField("outline.summary", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Memo: To Avoid</label>
                    <Input
                      value={editingChapter.memo?.to_avoid || ""}
                      onChange={(e) => updateChapterField("memo.to_avoid", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Memo: Notes</label>
                    <Input
                      value={editingChapter.memo?.notes || ""}
                      onChange={(e) => updateChapterField("memo.notes", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Segments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-base">Segments</CardTitle>
                  <Button variant="outline" size="sm" onClick={addSegment}>
                    + Segment
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(editingChapter.outline?.segments || []).map((seg, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Segment {seg.seg || i + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeSegment(i)}>
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Focus"
                        value={seg.focus}
                        onChange={(e) => updateSegment(i, "focus", e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Emotion"
                          value={seg.emotion}
                          onChange={(e) => updateSegment(i, "emotion", e.target.value)}
                        />
                        <Input
                          placeholder="Key Beat"
                          value={seg.key_beat}
                          onChange={(e) => updateSegment(i, "key_beat", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Location"
                          value={seg.location}
                          onChange={(e) => updateSegment(i, "location", e.target.value)}
                        />
                        <Input
                          placeholder="Time"
                          value={seg.time}
                          onChange={(e) => updateSegment(i, "time", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Characters (comma-separated)"
                          value={Array.isArray(seg.characters) ? seg.characters.join(", ") : ""}
                          onChange={(e) =>
                            updateSegment(i, "characters", e.target.value.split(",").map((s) => s.trim()))
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Target words"
                          value={seg.target_words || 1500}
                          onChange={(e) => updateSegment(i, "target_words", Number(e.target.value))}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button onClick={saveChapter} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {saved ? "Saved!" : "Save Chapter"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              Select a chapter to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
