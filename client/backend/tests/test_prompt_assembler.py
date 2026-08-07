"""提示词组装器字段回退回归测试。

回归 bug：前端大纲编辑器保存的 segment 只有 {summary, target_words}，但
prompt/assembler.assemble_segment_prompt 按 what_to_write/goal/emotional_tone/
characters/function/word_target 读 → 真实用户填的段落概要/字数在提示词里全空、
字数恒用默认 500。

修复：组装器做语义回退 —— goal←summary、word_target←target_words、
emotional_tone/characters←章级字段（emotional_design.primary_mood / outline.characters）。
"""

import asyncio
import tempfile

from filesystem.storage import get_storage
from prompt.assembler import assemble_segment_prompt


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _tmp_root() -> str:
    return tempfile.mkdtemp(prefix="test_prompt_assembler_")


def _seed(root: str):
    """写入最小 settings + 章文件（与前端保存结构一致）。"""
    _run_async(
        get_storage().write_yaml(
            root,
            "settings/writing-style.yaml",
            {"role": "一位小说家", "core_principles": "", "common_mistakes": ""},
        )
    )
    _run_async(
        get_storage().write_yaml(
            root,
            "settings/anti-ai.yaml",
            {"fatigue_words_zh": {}, "structural_tic_patterns": []},
        )
    )
    _run_async(get_storage().write_yaml(root, "threads.yaml", {"threads": {}}))
    _run_async(
        get_storage().write_yaml(
            root,
            "chapters/vol-1-ch-1.yaml",
            {
                "volume": 1,
                "chapter": 1,
                "title": "第一章",
                "outline": {
                    "summary": "主角来到边境城邦。",
                    "characters": ["张三"],
                },
                "memo": {},
                "emotional_design": {"primary_mood": "紧张"},
                "segments": [
                    {"summary": "城门初见城邦", "target_words": 800},
                    {"summary": "遇到神秘商人", "target_words": 1200},
                ],
            },
        )
    )


class TestAssembleSegmentPromptFieldFallback:
    def test_goal_falls_back_to_segment_summary(self):
        """本段目标 ← summary：前端无 goal 字段，不再为空。"""
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "本段目标：城门初见城邦" in prompt

    def test_word_target_falls_back_to_target_words(self):
        """字数 ← target_words：前端填的 800 不再被默认 500 覆盖。"""
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "约800字" in prompt

    def test_second_segment_uses_its_own_target_words(self):
        """每段各自 target_words：seg-2 应显示 1200 而非全部 800。"""
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 1, "测试小说"))
        assert "本段目标：遇到神秘商人" in prompt
        assert "约1200字" in prompt

    def test_emotional_tone_falls_back_to_chapter_primary_mood(self):
        """情绪基调 ← 章级 emotional_design.primary_mood。"""
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "情绪基调：紧张" in prompt

    def test_characters_fall_back_to_chapter_outline_characters(self):
        """出场角色 ← 章级 outline.characters。"""
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "出场角色：张三" in prompt

    def test_explicit_segment_fields_take_precedence(self):
        """segment 显式提供字段时优先，不回退到章级。"""
        root = _tmp_root()
        _seed(root)
        data = _run_async(get_storage().read_yaml(root, "chapters/vol-1-ch-1.yaml"))
        data["segments"][0]["goal"] = "自定义目标"
        data["segments"][0]["word_target"] = 1500
        data["segments"][0]["emotional_tone"] = "压抑"
        data["segments"][0]["characters"] = ["李四"]
        _run_async(get_storage().write_yaml(root, "chapters/vol-1-ch-1.yaml", data))
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "本段目标：自定义目标" in prompt
        assert "约1500字" in prompt
        assert "情绪基调：压抑" in prompt
        assert "出场角色：李四" in prompt
