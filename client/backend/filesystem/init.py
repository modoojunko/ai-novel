import os
import shutil
from pathlib import Path

from config import REFERENCE_DIR

TEMPLATE_DIR = (
    Path(REFERENCE_DIR)
    if REFERENCE_DIR
    else (Path(__file__).parent.parent.parent / "reference")
)

SKELETON_DIRS = [
    "settings/character-setting",
    "volumes",
    "chapters",
]

# 非设定文件：仍在本地骨架（author-intent / current-focus）
TEMPLATE_FILES = {
    "author-intent.md.template": "author-intent.md",
    "current-focus.md.template": "current-focus.md",
}

# settings 模板 → (相对路径, DB key)：只进 DB 不进盘（ADR-003）
SETTINGS_TEMPLATES = {
    "story.yaml.template": ("story.yaml", "story"),
    "world-setting.yaml.template": ("settings/world-setting.yaml", "world"),
    "writing-style.yaml.template": ("settings/writing-style.yaml", "style"),
    "anti-ai.yaml.template": ("settings/anti-ai.yaml", "anti-ai"),
    "hooks.yaml.template": ("settings/hooks.yaml", "hooks"),
}

SKELETON_FILES = [
    ("author-intent.md", "md"),
    ("current-focus.md", "md"),
]


def _init_project_skeleton_local(root_path: str):
    """Create novel project directory skeleton from templates."""
    # Normalise path to prevent traversal outside the intended directory
    root_path = os.path.normpath(os.path.abspath(root_path))

    os.makedirs(root_path, exist_ok=True)
    for d in SKELETON_DIRS:
        os.makedirs(os.path.join(root_path, d), exist_ok=True)

    for src_name, dst_rel in TEMPLATE_FILES.items():
        src = TEMPLATE_DIR / src_name
        dst = os.path.join(root_path, dst_rel)
        if src.exists():
            shutil.copy2(src, dst)
        else:
            Path(dst).touch()
