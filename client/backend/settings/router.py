from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth_local.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from novels.service import get_novel

router = APIRouter(prefix="/api/novels/{project_id}/settings", tags=["settings"])

VALID_TYPES = {"world", "style", "anti-ai", "hooks", "characters", "ai-model", "genre"}
FILE_MAP = {
    "world": "settings/world-setting.yaml",
    "style": "settings/writing-style.yaml",
    "anti-ai": "settings/anti-ai.yaml",
    "hooks": "settings/hooks.yaml",
    "ai-model": "settings/ai-model.yaml",
    "genre": "settings/genre.yaml",
}


@router.get("/character/{name}")
async def get_character(
    project_id: str,
    name: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    return (
        await get_storage().read_yaml(
            project.root_path, f"settings/character-setting/{name}.yaml"
        )
        or {}
    )


@router.put("/character/{name}")
async def update_character(
    project_id: str,
    name: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    await get_storage().write_yaml(
        project.root_path, f"settings/character-setting/{name}.yaml", body
    )
    return {"ok": True}


@router.get("/{type}")
async def get_settings(
    project_id: str,
    type: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    if type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid settings type: {type}")
    return await get_storage().read_yaml(project.root_path, FILE_MAP[type])


@router.put("/{type}")
async def update_settings(
    project_id: str,
    type: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    if type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid settings type: {type}")
    await get_storage().write_yaml(project.root_path, FILE_MAP[type], body)

    if project.current_phase == "init":
        project.current_phase = "settings"
        await db.commit()

    return {"ok": True}


@router.delete("/character/{name}")
async def delete_character(
    project_id: str,
    name: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    await get_storage().delete_file(
        project.root_path, f"settings/character-setting/{name}.yaml"
    )
    return {"ok": True}


@router.get("/characters/list")
async def list_characters(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    names = await get_storage().list_dir(
        project.root_path, "settings/character-setting"
    )
    return [n.replace(".yaml", "") for n in names if n.endswith(".yaml")]
