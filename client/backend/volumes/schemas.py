"""卷族 Pydantic 校验 — 四档长度纪律的唯一执行点。

SQLite 不强制 VARCHAR 长度；这里 max_length 真校验（422）：
标签/枚举 50；一句话 150；标题 200；短段落 300；ref 类章节区间 20（例外档）。
"""

from pydantic import BaseModel, Field

# ── 卷纲子项 ────────────────────────────────────────────────────────────────


class StageIn(BaseModel):
    stage_name: str = Field(max_length=50)
    stage_function: str = Field(max_length=300)
    chapter_count: int = Field(ge=0, le=999)


class LadderIn(BaseModel):
    layer_no: int = Field(ge=1, le=9)
    chapters_range: str = Field(default="", max_length=20)
    obstacle: str = Field(max_length=300)
    turning_type: str = Field(default="", max_length=50)
    turning_point: str = Field(default="", max_length=300)


class ChapterPlanIn(BaseModel):
    chapter_no: int = Field(ge=1, le=9999)
    title: str = Field(max_length=200)
    summary: str = Field(default="", max_length=300)
    emotional_anchor: str = Field(default="", max_length=150)
    info_gap: str = Field(default="", max_length=300)
    arc_position: str = Field(default="", max_length=150)


class VoiceIn(BaseModel):
    character_name: str = Field(max_length=50)
    situation: str = Field(default="", max_length=300)
    unfinished: str = Field(default="", max_length=300)
    interlude_thought: str = Field(default="", max_length=300)
    next_action: str = Field(default="", max_length=300)


# ── 卷本体 ──────────────────────────────────────────────────────────────────


class VolumeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=300)


class VolumeUpdate(BaseModel):
    """PUT /volumes/{ref} — 全字段可选，只更新显式传入的键。"""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=300)
    direction_method: str | None = Field(default=None, max_length=50)
    template_name: str | None = Field(default=None, max_length=50)
    core_conflict: str | None = Field(default=None, max_length=150)
    emotional_arc: str | None = Field(default=None, max_length=150)
    arc_mode: str | None = Field(default=None, max_length=50)
    primary_drive: str | None = Field(default=None, max_length=50)
    info_gap_start: str | None = Field(default=None, max_length=300)
    info_gap_end: str | None = Field(default=None, max_length=300)
    chapter_target: int | None = Field(default=None, ge=1, le=9999)
    # 子表整体替换（传入即全量重写该族，未传不动）
    stages: list[StageIn] | None = None
    conflict_ladders: list[LadderIn] | None = None
    chapter_plans: list[ChapterPlanIn] | None = None
    character_voices: list[VoiceIn] | None = None
