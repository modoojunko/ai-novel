// 章纲表单模型（OgPane / ChapterWorkspace 共用）：
// 扁平 OgForm ↔ 后端 ChapterData 的纯映射 + 必填缺口计算。
// 必填口径 = 后端 gate_chapter_ready 六项（与 book.html REQUIRED 一致）。
import type { ChapterData } from "@/hooks/useOutline";

export interface OgSeg {
  s: string;
  w: number;
}

export interface OgForm {
  title: string;
  summary: string;
  keys: string; // 一行一个 → outline.key_points[]
  chars: string; // 一行一个 → outline.characters[]
  loc: string;
  time: string;
  pov: string;
  pguid: string;
  task: string; // * → memo.current_task
  rstate: string; // * → memo.reader_expectation.state
  rstrat: string; // * → memo.reader_expectation.strategy
  rdetail: string; // → memo.reader_expectation.detail
  mres: string; // 一行一个 → memo.payoff_plan.must_resolve[]
  mhold: string; // 一行一个 → memo.payoff_plan.must_hold[]
  padv: string; // 一行一个 → memo.payoff_plan.partial_advance[]
  changes: string; // * 一行一个 → memo.required_changes[]
  ban: string; // 一行一个 → memo.prohibitions[]
  mood: string; // * → emotional_design.primary_mood
  segs: OgSeg[]; // * → segments[{summary,target_words}]
}

export const REQ_FIELDS: { key: keyof OgForm; label: string }[] = [
  { key: "task", label: "核心任务" },
  { key: "rstate", label: "读者当前状态" },
  { key: "rstrat", label: "预期策略" },
  { key: "changes", label: "必须完成的变化" },
  { key: "mood", label: "主情绪" },
  { key: "segs", label: "段落规划" },
];

export const EMPTY_OG_FORM: OgForm = {
  title: "",
  summary: "",
  keys: "",
  chars: "",
  loc: "",
  time: "",
  pov: "",
  pguid: "",
  task: "",
  rstate: "",
  rstrat: "",
  rdetail: "",
  mres: "",
  mhold: "",
  padv: "",
  changes: "",
  ban: "",
  mood: "",
  segs: [{ s: "", w: 800 }],
};

const lines = (s: string): string[] =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);

export function ogGaps(form: OgForm): { key: string; label: string }[] {
  const gaps: { key: string; label: string }[] = [];
  for (const { key, label } of REQ_FIELDS) {
    const v = form[key];
    const empty =
      key === "segs"
        ? (v as OgSeg[]).length === 0
        : String(v ?? "").trim() === "";
    if (empty) gaps.push({ key: String(key), label });
  }
  return gaps;
}

export function ogToForm(d: ChapterData | null | undefined): OgForm {
  const o = d?.outline ?? {};
  const m = d?.memo ?? {};
  const re = m.reader_expectation ?? {};
  const pp = m.payoff_plan ?? {};
  return {
    title: d?.title ?? "",
    summary: o.summary ?? "",
    keys: (o.key_points ?? []).join("\n"),
    chars: (o.characters ?? []).join("\n"),
    loc: o.location ?? "",
    time: o.time ?? "",
    pov: o.narrative_pov ?? "",
    pguid: o.perspective_guidance ?? "",
    task: m.current_task ?? "",
    rstate: re.state ?? "",
    rstrat: re.strategy ?? "",
    rdetail: re.detail ?? "",
    mres: (pp.must_resolve ?? []).join("\n"),
    mhold: (pp.must_hold ?? []).join("\n"),
    padv: (pp.partial_advance ?? []).join("\n"),
    changes: (m.required_changes ?? []).join("\n"),
    ban: (m.prohibitions ?? []).join("\n"),
    mood: d?.emotional_design?.primary_mood ?? "",
    segs: (d?.segments ?? []).map((s) => ({
      s: s.summary ?? "",
      w: s.target_words ?? 800,
    })),
  };
}

/** 保留 existing 中未知扩展键（后端 forward-compat），只覆写表单覆盖的字段 */
export function ogToPartial(
  form: OgForm,
  existing?: ChapterData | null,
): Partial<ChapterData> {
  return {
    title: form.title,
    outline: {
      ...(existing?.outline ?? {}),
      summary: form.summary,
      key_points: lines(form.keys),
      characters: lines(form.chars),
      location: form.loc,
      time: form.time,
      narrative_pov: form.pov,
      perspective_guidance: form.pguid,
    },
    memo: {
      ...(existing?.memo ?? {}),
      current_task: form.task,
      reader_expectation: {
        ...(existing?.memo?.reader_expectation ?? {}),
        state: form.rstate,
        strategy: form.rstrat,
        detail: form.rdetail,
      },
      payoff_plan: {
        ...(existing?.memo?.payoff_plan ?? {}),
        must_resolve: lines(form.mres),
        must_hold: lines(form.mhold),
        partial_advance: lines(form.padv),
      },
      required_changes: lines(form.changes),
      prohibitions: lines(form.ban),
    },
    emotional_design: {
      ...(existing?.emotional_design ?? {}),
      primary_mood: form.mood,
    },
    segments: form.segs.map((s) => ({ summary: s.s, target_words: s.w })),
  };
}
