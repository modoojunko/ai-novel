"""Tests for the prompt file loader."""

from prompts import load as load_prompt


class TestPromptLoader:
    def test_load_existing_prompt(self):
        """Loading an existing .prompt file returns non-empty string."""
        content = load_prompt("story_character")
        assert isinstance(content, str)
        assert len(content) > 100
        assert "{character_cognition}" in content

    def test_load_another_prompt(self):
        content = load_prompt("suggest_meta")
        assert isinstance(content, str)
        assert len(content) > 50

    def test_load_settings_world(self):
        content = load_prompt("settings_world")
        assert isinstance(content, str)
        assert "{premise}" in content or "设定" in content

    def test_load_story_stage(self):
        content = load_prompt("story_stage")
        assert isinstance(content, str)
        assert len(content) > 50
