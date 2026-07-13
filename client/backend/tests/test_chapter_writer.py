"""Tests for ChapterContext builder."""

from write.chapter_writer import ChapterContext


class TestChapterContext:
    def test_empty_context_returns_valid_prompt(self):
        ctx = ChapterContext()
        prompt = ctx.to_prompt()
        assert isinstance(prompt, str)
        assert len(prompt) > 50
        assert "## 角色定位" in prompt
        assert "## 原则与禁忌" in prompt
        assert "## 故事背景" in prompt
        assert "## 写作要求" in prompt

    def test_with_premise(self):
        ctx = ChapterContext()
        ctx.premise = "一个退役刑警调查悬案的故事"
        ctx.novel_title = "暗流"
        prompt = ctx.to_prompt()
        assert "暗流" in prompt
        assert "退役刑警" in prompt

    def test_with_world_setting(self):
        ctx = ChapterContext()
        ctx.world_setting = {"geography": {"scenes": "潮湿的南方城市"}, "politics": {"rule": "军阀割据"}, "rules": {"world": "没有超自然力量"}}
        prompt = ctx.to_prompt()
        assert "潮湿的南方城市" in prompt

    def test_with_style_settings(self):
        ctx = ChapterContext()
        ctx.style_setting = {"role": "冷峻的叙事者", "core_principles": ["简洁", "有力"], "common_mistakes": ["不要滥用形容词"], "depiction_techniques": {"action": "快速剪辑"}}
        prompt = ctx.to_prompt()
        assert "冷峻的叙事者" in prompt
        assert "快速剪辑" in prompt

    def test_with_hooks(self):
        ctx = ChapterContext()
        ctx.hooks = [{"description": "神秘信件"}, {"description": "失踪的钥匙"}]
        prompt = ctx.to_prompt()
        assert "神秘信件" in prompt

    def test_with_characters(self):
        ctx = ChapterContext()
        ctx.characters = [{"name": "张三", "state": "正在调查"}, {"name": "李四", "state": "隐藏身份"}]
        prompt = ctx.to_prompt()
        assert "张三" in prompt

    def test_flatten_fatigue_words(self):
        ctx = ChapterContext()
        result = ctx._flatten_fatigue_words({"副词": ["突然", "忽然"], "语气词": ["嗯", "啊"]})
        assert len(result) == 4
        assert "突然" in result

    def test_with_previous_chapter_recap(self):
        ctx = ChapterContext()
        ctx.previous_chapter_recap = "上一章结尾，张三推开了那扇门。"
        prompt = ctx.to_prompt()
        assert "上一章结尾" in prompt
