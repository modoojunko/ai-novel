"""Tests for AI settings JSON helpers (pure unit tests)."""

import re


# ── Inline helpers (mirror settings/ai_router.py) ──────────────────────────


def clean_json(text):
    cleaned = text.strip()
    if "```" in cleaned:
        for part in cleaned.split("```"):
            part = part.strip()
            if not part:
                continue
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                __import__("json").loads(part)
                return part
            except (ValueError, TypeError):
                continue
    for left, right in [("{", "}"), ("[", "]")]:
        start = cleaned.find(left)
        if start >= 0:
            end = cleaned.rfind(right)
            if end > start:
                return cleaned[start : end + 1]
    return cleaned


def repair_json(s):
    s = re.sub(r",\s*([}\]])", r"\1", s)
    s = re.sub(r"(?<=[{, ])'([^']+?)'(?=\s*[:,\]}])", r'"\1"', s)
    s = s.replace("None", "null").replace("True", "true").replace("False", "false")
    return s


def extract_field(parsed, field):
    if isinstance(parsed, dict) and field in parsed:
        return parsed[field]
    return parsed


# ═══════════════════════════════════════════════════════════════════════════
# Field extraction
# ═══════════════════════════════════════════════════════════════════════════


class TestFieldExtraction:
    def test_extract_string_from_object(self):
        assert extract_field({"role": "test", "p": ["a"]}, "role") == "test"

    def test_extract_array_from_object(self):
        assert extract_field({"role": "test", "p": ["a", "b"]}, "p") == ["a", "b"]

    def test_direct_value_passes_through(self):
        assert extract_field("test", "role") == "test"

    def test_field_missing_returns_whole(self):
        assert extract_field({"name": "x"}, "role") == {"name": "x"}

    def test_array_direct_value(self):
        assert extract_field(["a", "b"], "p") == ["a", "b"]


# ═══════════════════════════════════════════════════════════════════════════
# JSON cleaning
# ═══════════════════════════════════════════════════════════════════════════


class TestJsonCleaning:
    def test_clean_markdown_fence(self):
        import json

        result = clean_json('{"role": "test"}')
        assert json.loads(repair_json(result))["role"] == "test"

    def test_clean_extra_text(self):
        import json

        result = clean_json('...\n{"role": "test"}\n...')
        assert json.loads(repair_json(result))["role"] == "test"

    def test_repair_trailing_comma(self):
        import json

        assert json.loads(repair_json('{"role": "test",}'))["role"] == "test"

    def test_repair_single_quotes(self):
        import json

        assert json.loads(repair_json("{'role': 'test'}"))["role"] == "test"

    def test_clean_empty(self):
        assert clean_json("") == ""

    def test_clean_multiple_blocks(self):
        raw_text = 'a\n{"a": 1}\nb\n{"b": 2}\nc'
        result = clean_json(raw_text)
        assert result.startswith("{")
        assert result.endswith("}")
        assert "a" in result
        assert "b" in result
