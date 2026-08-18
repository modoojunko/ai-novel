from fastapi import HTTPException

from filesystem.storage import get_storage

# 每章版本快照上限：编辑器 1.5s 防抖自动保存每次变更都会写快照，
# 不设上限会随写作时长线性膨胀（读取/列表也跟着变慢）。
MAX_VERSIONS_PER_CHAPTER = 50


def _validate_ref(ref: str) -> str:
    if ".." in ref or "/" in ref:
        raise HTTPException(400, "Invalid chapter reference")
    return ref


def strip_suffix(ref: str, suffix: str = ".yaml") -> str:
    """剥 `.yaml` 尾缀：`vol-1.yaml` → `vol-1`（旧前端调用零断裂，BE-07）。"""
    return ref.removesuffix(suffix)


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
    if project.current_phase == new_phase:
        # 幂等：操作类接口（重新生成提示词/重复写入/连建章节）可能已处于目标阶段
        return
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
            # 快照上限：每章保留最近 MAX_VERSIONS_PER_CHAPTER 份，超出删最旧。
            # 版本文件名 v{毫秒时间戳} 同位数（13 位直到 2286 年），字典序即时间序。
            version_files = [
                f
                for f in await get_storage().list_dir(
                    root_path, f"versions/{chapter_ref}"
                )
                if f.endswith(".yaml")
            ]
            if len(version_files) > MAX_VERSIONS_PER_CHAPTER:
                version_files.sort()
                excess = len(version_files) - MAX_VERSIONS_PER_CHAPTER
                for old_file in version_files[:excess]:
                    await get_storage().delete_file(
                        root_path, f"versions/{chapter_ref}/{old_file}"
                    )
