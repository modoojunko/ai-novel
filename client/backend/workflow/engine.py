from fastapi import HTTPException

from filesystem.storage import get_storage


def _validate_ref(ref: str) -> str:
    if ".." in ref or "/" in ref:
        raise HTTPException(400, "Invalid chapter reference")
    return ref


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


async def load_chapter(root_path: str, chapter_ref: str) -> dict:
    return await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml")


async def save_chapter(root_path: str, chapter_ref: str, data: dict):
    """Save chapter data and create a version snapshot if content changed."""
    # Read old data before overwriting
    old_data = await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml")

    # Write new data
    await get_storage().write_yaml(root_path, f"chapters/{chapter_ref}.yaml", data)

    # Create version snapshot if content actually changed
    if old_data:
        old_prose = old_data.get("prose", "")
        new_prose = data.get("prose", "")
        old_outline = old_data.get("outline", {}).get("summary", "")
        new_outline = data.get("outline", {}).get("summary", "")

        if old_prose != new_prose or old_outline != new_outline:
            import time

            timestamp = int(time.time() * 1000)
            version_data = {
                "version": f"v{timestamp}",
                "chapter_ref": chapter_ref,
                "created_at": timestamp,
                "comment": "自动保存",
                "snapshot": {
                    "prose": new_prose,
                    "outline": data.get("outline", {}),
                    "status": data.get("status", ""),
                },
            }
            await get_storage().write_yaml(
                root_path, f"versions/{chapter_ref}/v{timestamp}.yaml", version_data
            )
