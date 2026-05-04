import os
from pathlib import Path

import yaml


def read_yaml(root_path: str, relative_path: str) -> dict:
    filepath = os.path.join(root_path, relative_path)
    if not os.path.exists(filepath):
        return {}
    with open(filepath, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def read_md(root_path: str, relative_path: str) -> str:
    filepath = os.path.join(root_path, relative_path)
    if not os.path.exists(filepath):
        return ""
    return Path(filepath).read_text(encoding="utf-8")


def list_dir(root_path: str, relative_path: str = "") -> list[str]:
    dirpath = os.path.join(root_path, relative_path)
    if not os.path.exists(dirpath):
        return []
    return os.listdir(dirpath)


def project_exists(root_path: str) -> bool:
    return os.path.exists(os.path.join(root_path, "story.yaml"))
