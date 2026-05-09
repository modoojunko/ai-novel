import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import ChapterTree, { parseChapterRefs } from "@/components/project/ChapterTree";
import AiSuggestButton from "@/components/ui/ai-suggest-button";
import { Save, Loader2, Send, Trash2 } from "lucide-react";

type Segment = {
  seg_number: number;
  function: string;
  goal: string;
  what_to_write: string;
  characters: string[];
  emotional_tone: string;
  word_target: number;
  ends_with: string;
  dialogue_intent: string;
};

type Chapter = {
  volume: number;
  chapter: number;
  title: string;
  outline: {
    summary: string;
    key_points: string[];
    characters: string[];
    location: string;
    time: string;
    narrative_pov: string;
  };
  memo: {
    current_task: string;
    reader_expectation: {
      state: string;
      strategy: string;
      detail: string;
    };
    required_changes: string[];
    prohibitions: string[];
    key_choices: string[];
  };
  emotional_design: {
    primary_mood: string;
    mood_progression: string;
    intensity_peak: string;
    satisfaction_beat: string;
    emotional_hook: string;
    intensity_level: number;
  };
  segments: Segment[];
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
    outline: { summary: "", key_points: [], characters: [], location: "", time: "", narrative_pov: "" },
    memo: {
      current_task: "",
      reader_expectation: { state: "", strategy: "", detail: "" },
      required_changes: [],
      prohibitions: [],
      key_choices: [],
    },
    emotional_design: {
      primary_mood: "",
      mood_progression: "",
      intensity_peak: "",
      satisfaction_beat: "",
      emotional_hook: "",
      intensity_level: 5,
    },
    segments: [],
    status: "outline",
  };
}

function emptySegment(segNum: number): Segment {
  return {
    seg_number: segNum,
    function: "",
    goal: "",
    what_to_write: "",
    characters: [],
    emotional_tone: "",
    word_target: 500,
    ends_with: "",
    dialogue_intent: "",
  };
}

export default function OutlinePage() {
  const { slug } = useParams<{ slug: string }>();
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
    setShowCreateVol(false);
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
    const segs = [...(editingChapter.segments || [])];
    segs.push(emptySegment(segs.length + 1));
    updateChapterField("segments", segs);
  }

  function updateSegment(idx: number, field: string, value: any) {
    if (!editingChapter) return;
    const segs = [...(editingChapter.segments || [])];
    (segs[idx] as any)[field] = value;
    updateChapterField("segments", segs);
  }

  function removeSegment(idx: number) {
    if (!editingChapter) return;
    const segs = editingChapter.segments?.filter((_, i) => i !== idx) || [];
    updateChapterField("segments", segs);
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
        <h2 className="text-2xl font-bold font-serif">大纲</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Volume/Chapter tree */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-base-content/60">卷·章结构</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateVol(true)}>
              + 新卷
            </button>
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
            <p className="text-sm text-base-content/60 p-4 text-center">暂无卷章，点击「新卷」开始</p>
          )}
        </div>

        {/* Right: Chapter editor */}
        <div>
          {editingChapter ? (
            <div className="space-y-4">
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <h3 className="card-title text-base">
                      vol-{editingChapter.volume} ch-{editingChapter.chapter}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => confirmChapter(`vol-${editingChapter.volume}-ch-${editingChapter.chapter}`)}
                      >
                        <Send className="w-3 h-3" /> 确认
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={saveChapter} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-3 h-3" />}
                        {saved ? "已保存" : "保存"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="label-text text-xs">章节标题</span>
                        <AiSuggestButton onClick={() => toast.info("即将上线")} />
                      </div>
                      <input
                        className="input input-bordered w-full"
                        value={editingChapter.title}
                        onChange={(e) => updateChapterField("title", e.target.value)}
                        placeholder="输入章节标题..."
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="label-text text-xs">章节概要</span>
                        <AiSuggestButton onClick={() => toast.info("即将上线")} />
                      </div>
                      <textarea
                        className="textarea textarea-bordered w-full h-24"
                        value={editingChapter.outline?.summary || ""}
                        onChange={(e) => updateChapterField("outline.summary", e.target.value)}
                        placeholder="概述这一章的核心内容..."
                      />
                    </div>

                    {/* Advanced fields */}
                    <div className="border border-base-300 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setShowAdvFields(!showAdvFields)}
                        className="flex items-center justify-between w-full px-3 py-2 text-xs text-base-content/60 hover:text-base-content transition-colors"
                      >
                        <span>更多字段</span>
                        <span className="text-[10px]">
                          {showAdvFields ? "▾ 视角、地点、读者预期" : "▸ POV、线索、时间线"}
                        </span>
                      </button>
                      {showAdvFields && (
                        <div className="px-3 pb-3 space-y-3 border-t border-base-300 pt-3">
                          <div>
                            <label className="label py-0.5"><span className="label-text text-[11px]">叙事视角</span></label>
                            <input
                              className="input input-bordered input-sm w-full"
                              value={editingChapter.outline?.narrative_pov || ""}
                              onChange={(e) => updateChapterField("outline.narrative_pov", e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label py-0.5"><span className="label-text text-[11px]">地点</span></label>
                              <input
                                className="input input-bordered input-sm w-full"
                                value={editingChapter.outline?.location || ""}
                                onChange={(e) => updateChapterField("outline.location", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="label py-0.5"><span className="label-text text-[11px]">时间</span></label>
                              <input
                                className="input input-bordered input-sm w-full"
                                value={editingChapter.outline?.time || ""}
                                onChange={(e) => updateChapterField("outline.time", e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="label py-0.5"><span className="label-text text-[11px]">当前任务（memo）</span></label>
                            <input
                              className="input input-bordered input-sm w-full"
                              value={editingChapter.memo?.current_task || ""}
                              onChange={(e) => updateChapterField("memo.current_task", e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label py-0.5"><span className="label-text text-[11px]">读者情绪状态</span></label>
                              <input
                                className="input input-bordered input-sm w-full"
                                value={editingChapter.memo?.reader_expectation?.state || ""}
                                onChange={(e) => updateChapterField("memo.reader_expectation.state", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="label py-0.5"><span className="label-text text-[11px]">情绪策略</span></label>
                              <input
                                className="input input-bordered input-sm w-full"
                                value={editingChapter.memo?.reader_expectation?.strategy || ""}
                                onChange={(e) => updateChapterField("memo.reader_expectation.strategy", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Segments */}
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <h3 className="card-title text-sm">段落划分</h3>
                    <button className="btn btn-outline btn-sm" onClick={addSegment}>
                      + 添加段落
                    </button>
                  </div>
                  <div className="space-y-1">
                    {(editingChapter.segments || []).map((seg: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-base-300/30 group">
                        <span className="text-[10px] text-base-content/60 w-4">{seg.seg_number || i + 1}</span>
                        <input
                          className="input input-bordered input-xs flex-1"
                          placeholder="段落主题..."
                          value={seg.goal || ""}
                          onChange={(e) => updateSegment(i, "goal", e.target.value)}
                        />
                        <input
                          className="input input-bordered input-xs w-20"
                          type="number"
                          placeholder="字数"
                          value={seg.word_target || 1500}
                          onChange={(e) => updateSegment(i, "word_target", Number(e.target.value))}
                        />
                        <button
                          onClick={() => removeSegment(i)}
                          className="opacity-0 group-hover:opacity-100 text-error/60 hover:text-error transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-base-content/60">
              选择左侧章节开始编辑
            </div>
          )}
        </div>
      </div>

      {showCreateVol && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold font-serif text-lg mb-4">创建新卷</h3>
            <div className="space-y-4">
              <input
                className="input input-bordered w-full"
                placeholder="卷标题..."
                value={volTitle}
                onChange={(e) => setVolTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createVolume()}
              />
              <div className="flex gap-3 justify-end">
                <button className="btn btn-ghost" onClick={() => setShowCreateVol(false)}>取消</button>
                <button className="btn btn-primary" onClick={createVolume} disabled={volumes.length >= 9}>
                  创建卷
                </button>
              </div>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreateVol(false)} />
        </div>
      )}
    </div>
  );
}
