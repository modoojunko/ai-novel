// GET /novels/{pid}/volumes/{ref} 详情契约（client/backend/volumes/service.get_volume）
// 标量字段 DB 可空，缺失时后端省略键 → 这里标 optional

export interface VolumeStage {
  stage_name: string;
  stage_function: string;
  chapter_count: number;
}

export interface VolumeConflictLadder {
  layer_no: number;
  chapters_range: string;
  obstacle: string;
  turning_type: string;
  turning_point: string;
}

export interface VolumeChapterPlan {
  chapter_no: number;
  title: string;
  summary: string;
  emotional_anchor: string;
  info_gap: string;
  arc_position: string;
}

export interface VolumeCharacterVoice {
  character_name: string;
  situation: string;
  unfinished: string;
  interlude_thought: string;
  next_action: string;
}

export interface VolumeChapterMeta {
  ref: string;
  volume: number;
  chapter: number;
  title: string;
  status: string;
  word_count: number;
  has_prose: boolean;
  outline_status: string;
  archived: boolean;
}

export interface VolumeDetail {
  ref: string;
  volume: number;
  title: string;
  summary: string;
  direction_method?: string | null;
  template_name?: string | null;
  core_conflict?: string | null;
  emotional_arc?: string | null;
  arc_mode?: string | null;
  primary_drive?: string | null;
  info_gap_start?: string | null;
  info_gap_end?: string | null;
  chapter_target?: number | null;
  stages: VolumeStage[];
  conflict_ladders: VolumeConflictLadder[];
  chapter_plans: VolumeChapterPlan[];
  character_voices: VolumeCharacterVoice[];
  chapters: VolumeChapterMeta[];
}
