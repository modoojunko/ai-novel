import os
from pathlib import Path

import yaml


def write_yaml(root_path: str, relative_path: str, data: dict):
    filepath = os.path.join(root_path, relative_path)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def write_md(root_path: str, relative_path: str, content: str):
    filepath = os.path.join(root_path, relative_path)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    Path(filepath).write_text(content, encoding="utf-8")
