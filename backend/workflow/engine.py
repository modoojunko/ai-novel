from filesystem.reader import read_yaml
from filesystem.writer import write_yaml

ALLOWED_TRANSITIONS = {
    "init": ["settings"],
    "settings": ["outline"],
    "outline": ["prompt"],
    "prompt": ["write"],
    "write": ["archive"],
    "archive": ["outline"],
}


def can_transition(current_phase: str, target_phase: str) -> bool:
    return target_phase in ALLOWED_TRANSITIONS.get(current_phase, [])


def update_phase(project, new_phase: str):
    if not can_transition(project.current_phase, new_phase):
        raise ValueError(
            f"Cannot transition from {project.current_phase} to {new_phase}"
        )
    project.current_phase = new_phase


def load_chapter(root_path: str, chapter_ref: str) -> dict:
    return read_yaml(root_path, f"chapters/{chapter_ref}.yaml")


def save_chapter(root_path: str, chapter_ref: str, data: dict):
    write_yaml(root_path, f"chapters/{chapter_ref}.yaml", data)
