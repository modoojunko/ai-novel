"""Prompt loader — reads .prompt files from this directory."""

import os


_PROMPTS_DIR = os.path.dirname(os.path.abspath(__file__))


def load(name: str) -> str:
    """Load a prompt template by name (without .prompt extension)."""
    path = os.path.join(_PROMPTS_DIR, f"{name}.prompt")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Prompt file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()
