"""提示词上下文注入增强回归测试。

覆盖 2026-08-13 字段清理 + 接入方案：
- 提示词面板路径补 story 简介 / 世界观（细粒度全字段）/ 卷概要
- 章纲增强：location/time/narrative_pov/required_changes/payoff_plan/reader_expectation
- 角色卡增强：role（前端键，兼容 story_role）/ 能力/技能/关系/背景/外貌 + personality 兜底
- 伏笔增强：priority/hook_type（兼容前端 type 键）
"""

import asyncio
import tempfile

from filesystem.storage import get_storage
from prompt.assembler import assemble_segment_prompt
from prompt.context import inject_character_snapshots


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _tmp_root() -> str:
    return tempfile.mkdtemp(prefix="test_context_injection_")


def _seed(root: str, chapter_extra: dict | None = None):
    """写入含 story/世界观/卷/角色/伏笔 + 章文件的最小工程。"""
    _run_async(
        get_storage().write_yaml(
            root,
            "story.yaml",
            {"title": "测试小说", "synopsis": "退隐杀手在城中村开面馆，仇家找上门。"},
        )
    )
    _run_async(
        get_storage().write_yaml(
            root,
            "settings/world-setting.yaml",
            {
                "geography": {"scenes": "老城区城中村", "climate": "南方潮湿", "limits": "城中村巷窄"},
                "politics": {"rule": "灰色地带自治", "factions": "两股地头蛇", "social": "底层群像", "cost": "不服从被驱逐"},
                "rules": {"world": "无灵异", "society": "白天安静夜晚喧嚣", "personal": "面馆不赊账"},
            },
        )
    )
    _run_async(
        get_storage().write_yaml(
            root,
            "settings/writing-style.yaml",
            {"role": "一位小说家", "core_principles": "", "possible_mistakes": ""},
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
            "volumes/vol-1.yaml",
            {"volume": 1, "title": "第一卷 进城", "summary": "主角在城中村立足，仇家开始找人。"},
        )
    )
    _run_async(
        get_storage().write_yaml(
            root,
            "settings/character-setting/张三.yaml",
            {
                "name": "张三",
                "role": "主角",  # 前端/AI 生成的键
                "appearance": "刀疤脸",
                "background": "前特种兵",
                "values": "不碰老弱",
                "abilities": "十步内感知杀意",
                "skills": "码头搏击",
                "relationships": "与李四有旧怨",
                "environment": "城中村面馆",
                "personality": "外冷内热，话少手快",
                "state_history": [],
            },
        )
    )
    _run_async(
        get_storage().write_yaml(
            root,
            "settings/hooks.yaml",
            {
                "active": [
                    {
                        "description": "面馆地契是假的",
                        "introduced_in": "",  # 本章引入的伏笔不注入，用空串保持"悬而未决"
                        "status": "pending",
                        "priority": 1,
                        "hook_type": "mystery",
                    },
                    {
                        "description": "仇家派来的人",
                        "introduced_in": "",  # 本章引入的伏笔不注入，用空串保持"悬而未决"
                        "status": "pending",
                        "priority": 2,
                        "type": "threat",  # 前端旧键，应兼容
                    },
                ]
            },
        )
    )
    chapter = {
        "volume": 1,
        "chapter": 1,
        "title": "第一章",
        "outline": {
            "summary": "主角来到城中村开面馆。",
            "key_points": ["安置行李", "开张"],
            "characters": ["张三"],
            "location": "城中村老巷",
            "time": "初秋傍晚",
            "narrative_pov": "第三人称有限视角",
        },
        "memo": {
            "current_task": "面馆开张，稳住地头蛇",
            "reader_expectation": {"detail": "读者在等仇家何时上门"},
            "required_changes": ["张三在城中村立足", "仇家得知面馆位置"],
            "payoff_plan": {"must_resolve": ["地契疑云"]},
            "prohibitions": ["不让李四露面"],
        },
        "emotional_design": {"primary_mood": "紧张"},
        "segments": [{"summary": "开张首日", "target_words": 800}],
    }
    if chapter_extra:
        chapter.update(chapter_extra)
    _run_async(
        get_storage().write_yaml(root, "chapters/vol-1-ch-1.yaml", chapter)
    )


class TestStoryWorldVolumeInjection:
    """提示词面板路径补简介/世界观/卷概要（此前完全不注入）。"""

    def test_synopsis_injected(self):
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "故事前提：退隐杀手在城中村开面馆，仇家找上门。" in prompt

    def test_world_all_fields_injected(self):
        """世界观 10 字段全部注入（不再只取每个大类第一个）。"""
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        for fragment in [
            "主要场景：老城区城中村",
            "气候：南方潮湿",
            "地理限制：城中村巷窄",
            "统治形式：灰色地带自治",
            "主要势力：两股地头蛇",
            "社会分层：底层群像",
            "不服从的代价：不服从被驱逐",
            "世界规则：无灵异",
            "社会规则：白天安静夜晚喧嚣",
            "个人规则：面馆不赊账",
        ]:
            assert fragment in prompt, f"缺少世界观字段：{fragment}"

    def test_volume_summary_injected(self):
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "本卷概要：主角在城中村立足，仇家开始找人。" in prompt


class TestChapterOutlineInjection:
    """章纲增强：场景/时间/视角/硬约束/读者预期注入。"""

    def test_scene_time_pov_injected(self):
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "场景：城中村老巷" in prompt
        assert "时间：初秋傍晚" in prompt
        assert "叙事视角：第三人称有限视角" in prompt

    def test_required_changes_injected(self):
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "本章必须完成的改变：张三在城中村立足; 仇家得知面馆位置" in prompt

    def test_payoff_plan_must_resolve_injected(self):
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "本章应兑现的伏笔：地契疑云" in prompt

    def test_reader_expectation_detail_injected(self):
        root = _tmp_root()
        _seed(root)
        prompt = _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))
        assert "读者在等什么：读者在等仇家何时上门" in prompt


class TestCharacterSnapshotInjection:
    """角色卡增强：role 前端键 + 详情字段 + personality 兜底状态。"""

    def test_role_and_detail_fields_injected(self):
        root = _tmp_root()
        _seed(root)
        snap = _run_async(
            inject_character_snapshots(root, ["张三"])
        )
        assert "身份：主角" in snap  # 前端键 role，而非模板 story_role
        assert "能力：十步内感知杀意" in snap
        assert "技能：码头搏击" in snap
        assert "关系：与李四有旧怨" in snap
        assert "背景：前特种兵" in snap
        assert "外貌：刀疤脸" in snap

    def test_personality_falls_back_when_state_history_empty(self):
        """state_history 为空（归档回写未上线前）→ personality 兜底当前状态。"""
        root = _tmp_root()
        _seed(root)
        snap = _run_async(inject_character_snapshots(root, ["张三"]))
        assert "当前状态：外冷内热，话少手快" in snap

    def test_state_history_takes_precedence_over_personality(self):
        root = _tmp_root()
        _seed(root)
        data = _run_async(get_storage().read_yaml(root, "settings/character-setting/张三.yaml"))
        data["state_history"] = [{"status": "已开店，被地头蛇盯上"}]
        _run_async(get_storage().write_yaml(root, "settings/character-setting/张三.yaml", data))
        snap = _run_async(inject_character_snapshots(root, ["张三"]))
        assert "当前状态：已开店，被地头蛇盯上" in snap
        assert "外冷内热" not in snap

    def test_story_role_legacy_key_still_works(self):
        """存量数据（模板键 story_role）兼容。"""
        root = _tmp_root()
        _seed(root)
        data = _run_async(get_storage().read_yaml(root, "settings/character-setting/张三.yaml"))
        del data["role"]
        data["story_role"] = "旧模板角色"
        _run_async(get_storage().write_yaml(root, "settings/character-setting/张三.yaml", data))
        snap = _run_async(inject_character_snapshots(root, ["张三"]))
        assert "身份：旧模板角色" in snap


class TestActiveHooksInjection:
    """伏笔增强：priority/hook_type 注入，兼容前端 type 键。"""

    def _prompt(self):
        root = _tmp_root()
        _seed(root)
        return root, _run_async(assemble_segment_prompt(root, "vol-1-ch-1", 0, "测试小说"))

    def test_priority_and_hook_type_injected(self):
        _, prompt = self._prompt()
        assert "面馆地契是假的（优先级：核心，类型：mystery）（状态：pending）" in prompt

    def test_legacy_type_key_supported(self):
        """前端旧键 type（非 hook_type）也能注入。"""
        _, prompt = self._prompt()
        assert "仇家派来的人（优先级：重要，类型：threat）（状态：pending）" in prompt
