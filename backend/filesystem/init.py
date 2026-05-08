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
    "prompts",
    "archives",
]

TEMPLATE_FILES = {
    "story.yaml.template": "story.yaml",
    "author-intent.md.template": "author-intent.md",
    "current-focus.md.template": "current-focus.md",
    "world-setting.yaml.template": "settings/world-setting.yaml",
    "writing-style.yaml.template": "settings/writing-style.yaml",
    "anti-ai.yaml.template": "settings/anti-ai.yaml",
    "hooks.yaml.template": "settings/hooks.yaml",
}

SKELETON_FILES = [
    ("story.yaml", "yaml"),
    ("author-intent.md", "md"),
    ("current-focus.md", "md"),
    ("settings/world-setting.yaml", "yaml"),
    ("settings/writing-style.yaml", "yaml"),
    ("settings/anti-ai.yaml", "yaml"),
    ("settings/hooks.yaml", "yaml"),
    ("threads.yaml", "yaml"),
]


def init_project_skeleton(root_path: str):
    """Create novel project directory skeleton from templates."""
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

    Path(os.path.join(root_path, "threads.yaml")).write_text("threads: {}\n")
