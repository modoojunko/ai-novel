"""ChapterContext builder — assembles all writing context into a prompt."""

from filesystem.storage import get_storage
from genres.service import build_genre_section, resolve_genre_context
from prompt.context import inject_world_setting
from settings.render import (
    build_tone_section,
    depiction_techniques_str,
    flatten_principles,
    fmt_mistakes,
)


class ChapterContext:
    """Holds all context data needed for writing a chapter."""

    def __init__(self):
        self.premise = ""
        self.world_setting = {}
        self.style_setting = {}
        self.anti_ai = {}
        self.hooks = []
        self.volume_summary = ""
        self.chapter_outline = {}
        self.characters = []
        self.previous_chapter_recap = ""
        self.novel_title = ""
        self.genre_section = ""
        self.genre_fatigue_words: list[str] = []

    def to_prompt(self) -> str:
        """Assemble full writing prompt from all context data."""
        lines = []

        # Role
        role = self.style_setting.get("role", "一位小说家")
        principles = flatten_principles(self.style_setting.get("core_principles"))
        lines.append("## 角色定位")
        lines.append(f"你是{role}。{' '.join(principles)}")
        lines.append("")

        # Genre section (题材定义注入，紧跟角色定位，先于正文指引生效)
        if self.genre_section:
            lines.append(self.genre_section)
            lines.append("")

        # Tone section (ADR-007：文风基调归文风表单，题材库不再注入)
        tone_section = build_tone_section(self.style_setting)
        if tone_section:
            lines.append(tone_section)
            lines.append("")

        # Rules
        mistakes = fmt_mistakes(self.style_setting.get("possible_mistakes"))
        fatigue = self._flatten_fatigue_words(self.anti_ai.get("fatigue_words_zh", {}))
        fatigue = list(dict.fromkeys(fatigue + self.genre_fatigue_words))
        tic_patterns = [
            r.get("pattern", "")
            for r in self.anti_ai.get("structural_tic_patterns", [])
        ]
        lines.append("## 原则与禁忌")
        if mistakes:
            lines.append(f"注意避免：{mistakes}")
        if fatigue:
            lines.append(f"禁止使用以下词汇：{', '.join(fatigue)}")
        if tic_patterns:
            lines.append(f"禁止以下句式：{', '.join(tic_patterns[:5])}")
        lines.append("")

        # Background
        lines.append("## 故事背景")
        lines.append(f"本段是《{self.novel_title}》的一章。")
        if self.premise:
            lines.append(f"故事前提：{self.premise}")
        # 世界观（细粒度全字段注入，与提示词面板路径共用 inject_world_setting）
        world_block = inject_world_setting(self.world_setting)
        if world_block:
            lines.append(world_block)
        if self.volume_summary:
            lines.append(f"本卷概要：{self.volume_summary}")
        lines.append("")

        # Chapter outline
        outline = self.chapter_outline
        lines.append("## 当前章节")
        lines.append(f"章纲：{outline.get('summary', '')}")
        key_points = outline.get("key_points", [])
        if key_points:
            lines.append(f"关键情节点：{'、'.join(key_points[:5])}")
        lines.append("")

        # Previous chapter recap
        if self.previous_chapter_recap:
            lines.append("## 前文回顾")
            lines.append(self.previous_chapter_recap)
            lines.append("")

        # Character snapshots
        if self.characters:
            lines.append("## 角色状态")
            for ch in self.characters[:5]:
                lines.append(f"- {ch.get('name', '?')}：{ch.get('state', '')}")
            lines.append("")

        # Active hooks
        if self.hooks:
            lines.append("## 活跃伏笔")
            for h in self.hooks[:8]:
                lines.append(f"- {h.get('description', '?')}")
            lines.append("")

        # Writing requirements
        techniques_str = depiction_techniques_str(self.style_setting)
        lines.append("## 写作要求")
        if techniques_str:
            lines.append(techniques_str)
        lines.append("输出长度：约 2500 字。")
        lines.append("语言：中文。")
        lines.append("写正文，不写章节标题，不写总结。")

        return "\n".join(lines)

    def _flatten_fatigue_words(self, fatigue_dict: dict) -> list[str]:
        words = []
        for category in fatigue_dict.values():
            if isinstance(category, list):
                words.extend(category)
        return words


async def build_chapter_context(
    root_path: str, chapter_ref: str, novel_title: str = ""
) -> ChapterContext:
    """Read all data sources and build a ChapterContext."""
    ctx = ChapterContext()
    ctx.novel_title = novel_title

    # Premise
    story = await get_storage().read_yaml(root_path, "story.yaml") or {}
    ctx.premise = story.get("synopsis", "")

    # Settings
    ctx.world_setting = (
        await get_storage().read_yaml(root_path, "settings/world-setting.yaml") or {}
    )
    ctx.style_setting = (
        await get_storage().read_yaml(root_path, "settings/writing-style.yaml") or {}
    )
    ctx.anti_ai = (
        await get_storage().read_yaml(root_path, "settings/anti-ai.yaml") or {}
    )

    # Hooks
    hooks_data = await get_storage().read_yaml(root_path, "settings/hooks.yaml") or {}
    ctx.hooks = hooks_data.get("active", [])  # 对应 settings_hooks.prompt 输出

    # Genre（题材定义注入，定义缺失时优雅降级为空）
    gctx = await resolve_genre_context(root_path)
    if gctx:
        ctx.genre_section = build_genre_section(gctx)
        ctx.genre_fatigue_words = gctx.get("fatigue_words", [])

    # Chapter
    chapter = (
        await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml") or {}
    )
    ctx.chapter_outline = chapter.get("outline", {})
    if not isinstance(ctx.chapter_outline, dict):
        ctx.chapter_outline = {}

    # Volume info（卷族入库：卷概要改从 DB 取）
    import re

    vol_match = re.match(r"vol-(\d+)", chapter_ref)
    if vol_match:
        from db import async_session
        from repositories import volume_repo

        async with async_session() as session:
            ctx.volume_summary = await volume_repo.get_summary_by_root(
                session, root_path, int(vol_match.group(1))
            )

    # Characters in this chapter
    char_names = ctx.chapter_outline.get("characters", [])
    if isinstance(char_names, list):
        for name in char_names[:5]:
            if isinstance(name, str):
                ch_data = (
                    await get_storage().read_yaml(
                        root_path, f"settings/character-setting/{name}.yaml"
                    )
                    or {}
                )
                state = ""
                state_history = ch_data.get("state_history", [])
                if isinstance(state_history, list) and state_history:
                    last = state_history[-1]
                    if isinstance(last, dict):
                        state = last.get("state", "")
                ctx.characters.append({"name": name, "state": state})

    # Previous chapter recap
    ch_num = chapter.get("chapter", 0)
    vol_num_match = re.match(r"vol-(\d+)", chapter_ref)
    if vol_num_match and ch_num > 1:
        prev_ref = f"vol-{vol_num_match.group(1)}-ch-{ch_num - 1}"
        prev = (
            await get_storage().read_yaml(root_path, f"chapters/{prev_ref}.yaml") or {}
        )
        prev_prose = prev.get("prose", "")
        if prev_prose:
            ctx.previous_chapter_recap = prev_prose[-500:]

    return ctx
