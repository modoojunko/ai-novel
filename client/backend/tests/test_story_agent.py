"""Tests for character agent -- JSON parsing, validation, fallback logic."""

from story.character_agent import (
    _extract_json,
    _repair_json,
    _extract_fallback_text,
    _validate_decision_data,
)


class TestExtractJson:
    def test_direct_json(self):
        result = _extract_json('{"see": "箭飞来", "action_type": "移动"}')
        assert result is not None
        assert result["see"] == "箭飞来"
        assert result["action_type"] == "移动"

    def test_markdown_fence(self):
        result = _extract_json('```json\n{"see": "箭飞来"}\n```')
        assert result is not None
        assert result["see"] == "箭飞来"

    def test_with_extra_text(self):
        result = _extract_json('思考过程...\n{"see": "箭飞来"}\n总结...')
        assert result is not None
        assert result["see"] == "箭飞来"

    def test_chinese_punctuation(self):
        result = _extract_json('{"see": "箭飞来，风声", "hear": "脚步声"}')
        assert result is not None
        assert result["see"] == "箭飞来，风声"

    def test_trailing_comma(self):
        result = _extract_json('{"see": "箭飞来", "hear": "风声",}')
        assert result is not None
        assert result["see"] == "箭飞来"

    def test_single_quotes(self):
        result = _extract_json("{'see': '箭飞来', 'hear': '风声'}")
        assert result is not None
        assert result["see"] == "箭飞来"

    def test_none_literal(self):
        result = _extract_json('{"see": null, "hear": "风声"}')
        assert result is not None
        # _extract_json returns raw JSON; null becomes None
        assert result["see"] is None
        assert result["hear"] == "风声"

    def test_plain_text_fallback(self):
        result = _extract_json(" 张三冷笑一声，按住刀柄  ")
        assert result is not None
        assert "张三冷笑一声" in result.get("action_description", "")

    def test_gibberish_returns_none(self):
        # All lines are short (< 8 chars) or contain analysis keywords,
        # so _extract_fallback_text also returns None
        result = _extract_json("ab cd ef")
        assert result is None


class TestRepairJson:
    def test_chinese_colon(self):
        repaired = _repair_json('{"see"："箭"}')
        assert repaired is not None
        import json

        data = json.loads(repaired)
        assert data["see"] == "箭"

    def test_true_literal(self):
        repaired = _repair_json('{"active": True}')
        assert repaired is not None
        import json

        data = json.loads(repaired)
        assert data["active"] is True

    def test_none_literal(self):
        repaired = _repair_json('{"val": None}')
        assert repaired is not None
        import json

        data = json.loads(repaired)
        assert data["val"] is None


class TestValidateDecisionData:
    def test_all_fields_string(self):
        data = {"see": "箭", "action_type": "移动", "action_description": "躲"}
        result = _validate_decision_data(data)
        assert result["see"] == "箭"

    def test_none_field_becomes_empty(self):
        data = {"see": None, "action_type": None}
        result = _validate_decision_data(data)
        assert result["see"] == ""
        assert result["action_type"] == ""

    def test_int_field_becomes_string(self):
        data = {"stamina": 100}
        result = _validate_decision_data(data)
        # stamina is not in STRING_FIELDS, should be ignored
        assert "stamina" not in result

    def test_missing_field_gets_empty(self):
        data = {}
        result = _validate_decision_data(data)
        assert result["see"] == ""
        assert result["action_type"] == ""


class TestExtractFallbackText:
    def test_skips_analysis_lines(self):
        text = "分析局势后，我决定躲到岩石后\n因为那里可以掩护"
        result = _extract_fallback_text(text)
        assert result is None  # all lines contain analysis keywords

    def test_picks_action_line(self):
        text = "我考虑了一下\n张三一个翻滚躲到巨岩后\n因为那里安全"
        result = _extract_fallback_text(text)
        assert result is not None
        assert "翻滚躲到巨岩后" in result["action_description"]

    def test_short_lines_ignored(self):
        text = "好\n是\n他"
        result = _extract_fallback_text(text)
        assert result is None
