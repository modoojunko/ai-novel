// 卷纲面板表单态 ↔ PUT /volumes/{ref} payload
// 语义：字符串标量空串=清空；chapter_target 留空=不提交（后端 int 无清空通道）；
// 四子表提交即整族替换（后端 clear→flush→insert）

import type {
  VolumeChapterPlan,
  VolumeCharacterVoice,
  VolumeConflictLadder,
  VolumeDetail,
  VolumeStage,
} from "./types";

export interface VolumeFormData {
  title: string;
  summary: string;
  direction_method: string;
  template_name: string;
  core_conflict: string;
  emotional_arc: string;
  arc_mode: string;
  primary_drive: string;
  info_gap_start: string;
  info_gap_end: string;
  chapter_target: string;
  stages: VolumeStage[];
  conflict_ladders: VolumeConflictLadder[];
  chapter_plans: VolumeChapterPlan[];
  character_voices: VolumeCharacterVoice[];
}

export function toVolumeFormData(d: VolumeDetail): VolumeFormData {
  return {
    title: d.title || "",
    summary: d.summary || "",
    direction_method: d.direction_method || "",
    template_name: d.template_name || "",
    core_conflict: d.core_conflict || "",
    emotional_arc: d.emotional_arc || "",
    arc_mode: d.arc_mode || "",
    primary_drive: d.primary_drive || "",
    info_gap_start: d.info_gap_start || "",
    info_gap_end: d.info_gap_end || "",
    chapter_target: d.chapter_target != null ? String(d.chapter_target) : "",
    stages: (d.stages || []).map((s) => ({ ...s })),
    conflict_ladders: (d.conflict_ladders || []).map((l) => ({ ...l })),
    chapter_plans: (d.chapter_plans || []).map((p) => ({ ...p })),
    character_voices: (d.character_voices || []).map((v) => ({ ...v })),
  };
}

export function volumeFormToPayload(f: VolumeFormData): Record<string, unknown> {
  const target = f.chapter_target.trim();
  return {
    title: f.title.trim(),
    summary: f.summary,
    direction_method: f.direction_method,
    template_name: f.template_name,
    core_conflict: f.core_conflict,
    emotional_arc: f.emotional_arc,
    arc_mode: f.arc_mode,
    primary_drive: f.primary_drive,
    info_gap_start: f.info_gap_start,
    info_gap_end: f.info_gap_end,
    // 1-9999 钳制（非数回落 1；留空 = 不提交，后端 int 无清空通道）
    ...(target
      ? {
          chapter_target: Math.max(
            1,
            Math.min(9999, Math.floor(Number(target)) || 1),
          ),
        }
      : {}),
    stages: f.stages,
    conflict_ladders: f.conflict_ladders,
    chapter_plans: f.chapter_plans,
    character_voices: f.character_voices,
  };
}
