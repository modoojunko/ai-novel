import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Field,
  InputField,
  ListEditor,
  TabBar,
  SaveButton,
} from "@/components/novel/settings/FormField";
import ConfirmToggle from "@/components/novel/settings/ConfirmToggle";
import SegmentReorderList from "./SegmentReorderList";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChapterData {
  volume: number;
  chapter: number;
  title: string;
  status: string;
  outline?: {
    summary?: string;
    key_points?: string[];
    characters?: string[];
    location?: string;
    time?: string;
    narrative_pov?: string;
    perspective_guidance?: string;
  };
  memo?: {
    current_task?: string;
    reader_expectation?: { state?: string; strategy?: string; detail?: string };
    payoff_plan?: {
      must_resolve?: string[];
      must_hold?: string[];
      partial_advance?: string[];
    };
    required_changes?: string[];
    prohibitions?: string[];
  };
  emotional_design?: {
    primary_mood?: string;
  };
  segments?: Array<{ summary: string; target_words: number }>;
}

interface OutlineEditorProps {
  projectId: string;
  chapterRef: string;
  chapterData?: ChapterData | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSave: (ref: string, data: Partial<ChapterData>) => Promise<void>;
  onConfirm: (ref: string) => Promise<void>;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Internal form data shape (grouped to match tabs)
// ---------------------------------------------------------------------------

interface FormData {
  outline: {
    summary: string;
    key_points: string[];
    characters: string[];
    location: string;
    time: string;
    narrative_pov: string;
    perspective_guidance: string;
  };
  memo: {
    current_task: string;
    reader_expectation: { state: string; strategy: string; detail: string };
    payoff_plan: {
      must_resolve: string[];
      must_hold: string[];
      partial_advance: string[];
    };
    required_changes: string[];
    prohibitions: string[];
  };
  emotional_design: {
    primary_mood: string;
  };
  segments: Array<{ summary: string; target_words: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
  { id: "outline-summary", label: "章纲概要" },
  { id: "core-task", label: "核心任务" },
  { id: "reader-expectation", label: "读者预期" },
  { id: "emotional-design", label: "情绪设计" },
  { id: "segment-plan", label: "段落规划" },
];

const MOOD_OPTIONS = [
  "紧张",
  "悬疑",
  "温暖",
  "悲伤",
  "激昂",
  "轻松",
  "压抑",
  "浪漫",
  "惊悚",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyFormData(): FormData {
  return {
    outline: {
      summary: "",
      key_points: [],
      characters: [],
      location: "",
      time: "",
      narrative_pov: "",
      perspective_guidance: "",
    },
    memo: {
      current_task: "",
      reader_expectation: { state: "", strategy: "", detail: "" },
      payoff_plan: { must_resolve: [], must_hold: [], partial_advance: [] },
      required_changes: [],
      prohibitions: [],
    },
    emotional_design: { primary_mood: "" },
    segments: [],
  };
}

function extractFormData(cd: ChapterData): FormData {
  const o = cd.outline || {};
  const m = cd.memo || {};
  const re = m.reader_expectation || {};
  const pp = m.payoff_plan || {};
  const ed = cd.emotional_design || {};
  return {
    outline: {
      summary: o.summary || "",
      key_points: o.key_points || [],
      characters: o.characters || [],
      location: o.location || "",
      time: o.time || "",
      narrative_pov: o.narrative_pov || "",
      perspective_guidance: o.perspective_guidance || "",
    },
    memo: {
      current_task: m.current_task || "",
      reader_expectation: {
        state: re.state || "",
        strategy: re.strategy || "",
        detail: re.detail || "",
      },
      payoff_plan: {
        must_resolve: pp.must_resolve || [],
        must_hold: pp.must_hold || [],
        partial_advance: pp.partial_advance || [],
      },
      required_changes: m.required_changes || [],
      prohibitions: m.prohibitions || [],
    },
    emotional_design: { primary_mood: ed.primary_mood || "" },
    segments: cd.segments || [],
  };
}

function toPartialChapterData(fd: FormData): Partial<ChapterData> {
  return {
    outline: { ...fd.outline },
    memo: { ...fd.memo },
    emotional_design: { ...fd.emotional_design },
    segments: fd.segments,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return a === b;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false;
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k]
    )
  );
}

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Form label wrapper (used for ListEditor which doesn't have a label prop)
// ---------------------------------------------------------------------------

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-base-content/60 font-medium block tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OutlineEditor
// ---------------------------------------------------------------------------

export default function OutlineEditor({
  chapterRef,
  chapterData,
  loading = false,
  error = null,
  onRetry,
  onSave,
  onConfirm,
  onBack,
}: OutlineEditorProps) {
  // ── Form state ──────────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormData>(() =>
    chapterData ? extractFormData(chapterData) : emptyFormData()
  );
  const initialSnapshotRef = useRef<FormData>(
    chapterData ? extractFormData(chapterData) : emptyFormData()
  );

  const [activeTab, setActiveTab] = useState("outline-summary");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showCustomMood, setShowCustomMood] = useState(() => {
    if (!chapterData) return false;
    const mood = chapterData.emotional_design?.primary_mood || "";
    return mood !== "" && !MOOD_OPTIONS.includes(mood);
  });

  // ── Refs for reliable closures ──────────────────────────────────────
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const savingRef = useRef(false);
  const isDirtyRef = useRef(false);

  const isDirty = useMemo(
    () => !deepEqual(formData, initialSnapshotRef.current),
    [formData]
  );
  isDirtyRef.current = isDirty;

  // ── Reset form when chapterData changes from outside ────────────────
  useEffect(() => {
    if (!chapterData) return;
    const fd = extractFormData(chapterData);
    setFormData(fd);
    initialSnapshotRef.current = fd;
    setSaveStatus("idle");
    const mood = chapterData.emotional_design?.primary_mood || "";
    setShowCustomMood(mood !== "" && !MOOD_OPTIONS.includes(mood));
  }, [chapterData]);

  // ── Track dirty → status transition ─────────────────────────────────
  useEffect(() => {
    if (isDirty && saveStatus === "idle") setSaveStatus("dirty");
    else if (isDirty && saveStatus === "saved") setSaveStatus("dirty");
    else if (!isDirty && saveStatus === "dirty") setSaveStatus("idle");
  }, [isDirty, saveStatus]);

  // ── Auto-save: 3s debounce ──────────────────────────────────────────
  useEffect(() => {
    if (!isDirty || saveStatus === "saving" || saveStatus === "error") return;

    const timer = setTimeout(async () => {
      savingRef.current = true;
      setSaveStatus("saving");
      try {
        await onSave(chapterRef, toPartialChapterData(formDataRef.current));
        initialSnapshotRef.current = JSON.parse(
          JSON.stringify(formDataRef.current)
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      } finally {
        savingRef.current = false;
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [formData, isDirty, chapterRef, onSave]);

  // ── Auto-clear "saved" after 2s ─────────────────────────────────────
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const timer = setTimeout(() => {
      setSaveStatus((prev) => {
        if (prev !== "saved") return prev;
        return isDirtyRef.current ? "dirty" : "idle";
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  // ── Manual save handler ─────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      await onSave(chapterRef, toPartialChapterData(formData));
      initialSnapshotRef.current = JSON.parse(JSON.stringify(formData));
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, [formData, chapterRef, onSave]);

  // ── Back with dirty confirm ─────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (isDirty) {
      if (
        window.confirm(
          "有未保存的修改，确定返回吗？未保存的修改将丢失。"
        )
      ) {
        onBack();
      }
    } else {
      onBack();
    }
  }, [isDirty, onBack]);

  // ── Title context ───────────────────────────────────────────────────
  const titleContext = useMemo(() => {
    if (!chapterData) return "细化章节细纲";
    return `细化章节细纲 — 第${chapterData.volume}卷·第${chapterData.chapter}章 ${chapterData.title || ""}`;
  }, [chapterData]);

  const confirmed =
    chapterData?.status !== undefined && chapterData.status === "confirmed";

  // ── Save status label ───────────────────────────────────────────────
  const saveLabel = useMemo<{
    text: string;
    className: string;
    spinner: boolean;
  } | null>(() => {
    switch (saveStatus) {
      case "saving":
        return { text: "保存中…", className: "text-primary", spinner: true };
      case "saved":
        return {
          text: "已保存",
          className: "text-success/70",
          spinner: false,
        };
      case "dirty":
        return {
          text: "⚠️ 未保存",
          className: "text-warning",
          spinner: false,
        };
      case "error":
        return { text: "保存失败", className: "text-error", spinner: false };
      default:
        return null;
    }
  }, [saveStatus]);

  // ── Form updater helpers ────────────────────────────────────────────
  const updateOutline = useCallback(
    (field: string, value: string | string[]) => {
      setFormData((prev) => ({
        ...prev,
        outline: { ...prev.outline, [field]: value as never },
      }));
    },
    []
  );

  const updateMemo = useCallback(
    (field: string, value: string | string[]) => {
      setFormData((prev) => ({
        ...prev,
        memo: { ...prev.memo, [field]: value as never },
      }));
    },
    []
  );

  const updateReaderExpectation = useCallback(
    (field: string, value: string) => {
      setFormData((prev) => ({
        ...prev,
        memo: {
          ...prev.memo,
          reader_expectation: {
            ...prev.memo.reader_expectation,
            [field]: value,
          },
        },
      }));
    },
    []
  );

  const updatePayoffPlan = useCallback(
    (field: string, value: string[]) => {
      setFormData((prev) => ({
        ...prev,
        memo: {
          ...prev.memo,
          payoff_plan: {
            ...prev.memo.payoff_plan,
            [field]: value,
          },
        },
      }));
    },
    []
  );

  const updateEmotionalDesign = useCallback(
    (field: string, value: string) => {
      setFormData((prev) => ({
        ...prev,
        emotional_design: { ...prev.emotional_design, [field]: value },
      }));
    },
    []
  );

  const setSegments = useCallback(
    (segments: FormData["segments"]) => {
      setFormData((prev) => ({ ...prev, segments }));
    },
    []
  );

  // =====================================================================
  // Render
  // =====================================================================

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-10 w-full" />
        <div className="space-y-3">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-error text-sm">{error}</p>
        <div className="flex gap-2">
          {onRetry && (
            <button onClick={onRetry} className="btn btn-primary btn-sm">
              重试
            </button>
          )}
          <button onClick={onBack} className="btn btn-ghost btn-sm">
            返回概览
          </button>
        </div>
      </div>
    );
  }

  // ── No data ─────────────────────────────────────────────────────────
  if (!chapterData) return null;

  // ── Normal state ────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="btn btn-ghost btn-sm gap-1.5 text-base-content/60 hover:text-base-content"
        >
          ← 返回概览
        </button>

        <h2 className="text-lg font-serif font-semibold text-base-content truncate mx-4">
          {titleContext}
        </h2>

        <div className="w-24 text-right shrink-0">
          {saveLabel && (
            <span
              className={`text-xs inline-flex items-center gap-1 ${saveLabel.className}`}
            >
              {saveLabel.spinner && (
                <span className="loading loading-spinner loading-xs" />
              )}
              {saveLabel.text}
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* ───────────────────────────────────────────────────────────────
          Tab 1: 章纲概要
          ─────────────────────────────────────────────────────────────── */}
      {activeTab === "outline-summary" && (
        <div className="space-y-5">
          <Field
            label="章纲概要"
            value={formData.outline.summary}
            onChange={(v) => updateOutline("summary", v)}
          />
          <FormSection label="关键事件">
            <ListEditor
              items={formData.outline.key_points}
              onChange={(v) => updateOutline("key_points", v)}
              placeholder="一个关键事件"
            />
          </FormSection>
          <FormSection label="出场角色">
            <ListEditor
              items={formData.outline.characters}
              onChange={(v) => updateOutline("characters", v)}
              placeholder="角色名"
            />
          </FormSection>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="地点"
              value={formData.outline.location}
              onChange={(v) => updateOutline("location", v)}
              placeholder="本章主要场景地点"
            />
            <InputField
              label="时间"
              value={formData.outline.time}
              onChange={(v) => updateOutline("time", v)}
              placeholder="本章时间背景"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="叙事视角"
              value={formData.outline.narrative_pov}
              onChange={(v) => updateOutline("narrative_pov", v)}
              placeholder="如：第三人称有限"
            />
            <InputField
              label="视角指导"
              value={formData.outline.perspective_guidance}
              onChange={(v) => updateOutline("perspective_guidance", v)}
              placeholder="视角切换注意事项"
            />
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────
          Tab 2: 核心任务
          ─────────────────────────────────────────────────────────────── */}
      {activeTab === "core-task" && (
        <div className="space-y-5">
          <Field
            label="核心任务"
            value={formData.memo.current_task}
            onChange={(v) => updateMemo("current_task", v)}
          />
          <FormSection label="必须完成的变化">
            <ListEditor
              items={formData.memo.required_changes}
              onChange={(v) => updateMemo("required_changes", v)}
              placeholder="一个必须发生的变化"
            />
          </FormSection>
          <FormSection label="禁止事项">
            <ListEditor
              items={formData.memo.prohibitions}
              onChange={(v) => updateMemo("prohibitions", v)}
              placeholder="一个禁止发生的事"
            />
          </FormSection>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────
          Tab 3: 读者预期
          ─────────────────────────────────────────────────────────────── */}
      {activeTab === "reader-expectation" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="读者当前状态"
              value={formData.memo.reader_expectation.state}
              onChange={(v) => updateReaderExpectation("state", v)}
              placeholder="读者此时的情感状态"
            />
            <InputField
              label="预期策略"
              value={formData.memo.reader_expectation.strategy}
              onChange={(v) => updateReaderExpectation("strategy", v)}
              placeholder="希望读者如何感受"
            />
          </div>
          <Field
            label="预期细节说明"
            value={formData.memo.reader_expectation.detail}
            onChange={(v) => updateReaderExpectation("detail", v)}
          />

          {/* Separator */}
          <div className="border-t border-base-300/40 pt-5">
            <h3 className="text-sm font-medium text-base-content/80 mb-4">
              伏笔回收计划
            </h3>
          </div>

          <FormSection label="必须在本章回收">
            <ListEditor
              items={formData.memo.payoff_plan.must_resolve}
              onChange={(v) => updatePayoffPlan("must_resolve", v)}
              placeholder="一个必须回收的伏笔"
            />
          </FormSection>
          <FormSection label="必须维持悬念">
            <ListEditor
              items={formData.memo.payoff_plan.must_hold}
              onChange={(v) => updatePayoffPlan("must_hold", v)}
              placeholder="一个必须维持的悬念"
            />
          </FormSection>
          <FormSection label="可部分推进">
            <ListEditor
              items={formData.memo.payoff_plan.partial_advance}
              onChange={(v) => updatePayoffPlan("partial_advance", v)}
              placeholder="一个可部分推进的线索"
            />
          </FormSection>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────
          Tab 4: 情绪设计
          ─────────────────────────────────────────────────────────────── */}
      {activeTab === "emotional-design" && (
        <div className="space-y-5 max-w-md">
          <div>
            <label className="text-xs text-base-content/60 font-medium block tracking-wide mb-1.5">
              主情绪
            </label>
            <select
              className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60"
              value={
                showCustomMood
                  ? "__custom__"
                  : formData.emotional_design.primary_mood || ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom__") {
                  setShowCustomMood(true);
                  setFormData((prev) => ({
                    ...prev,
                    emotional_design: {
                      ...prev.emotional_design,
                      primary_mood: "",
                    },
                  }));
                } else {
                  setShowCustomMood(false);
                  updateEmotionalDesign("primary_mood", v);
                }
              }}
            >
              <option value="">请选择主情绪</option>
              {MOOD_OPTIONS.map((mood) => (
                <option key={mood} value={mood}>
                  {mood}
                </option>
              ))}
              <option value="__custom__">自定义</option>
            </select>

            {showCustomMood && (
              <input
                className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 mt-2"
                value={formData.emotional_design.primary_mood}
                onChange={(e) =>
                  updateEmotionalDesign("primary_mood", e.target.value)
                }
                placeholder="输入自定义情绪"
              />
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────
          Tab 5: 段落规划
          ─────────────────────────────────────────────────────────────── */}
      {activeTab === "segment-plan" && (
        <SegmentReorderList
          segments={formData.segments}
          onChange={setSegments}
        />
      )}

      {/* ── Bottom bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-4 border-t border-base-300">
        <div className="flex items-center gap-3">
          <SaveButton
            saving={saveStatus === "saving"}
            onClick={handleSave}
          />
          {saveLabel && (
            <span
              className={`text-xs inline-flex items-center gap-1 ${saveLabel.className}`}
            >
              {saveLabel.spinner && (
                <span className="loading loading-spinner loading-xs" />
              )}
              {saveLabel.text}
            </span>
          )}
          {saveStatus === "error" && (
            <button
              onClick={handleSave}
              className="text-xs text-error hover:text-error/80 underline"
            >
              重试
            </button>
          )}
        </div>
        <ConfirmToggle
          confirmed={confirmed}
          onToggle={() => onConfirm(chapterRef)}
        />
      </div>
    </div>
  );
}

export type { ChapterData, OutlineEditorProps, FormData };
