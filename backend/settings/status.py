from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project

router = APIRouter(prefix="/api/projects/{project_id}/settings", tags=["settings"])

VALID_TYPES = {"world", "style", "anti-ai", "hooks", "characters"}
STATUS_FILE = "settings/settings-status.yaml"


@router.get("/status")
async def get_settings_status(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    data = await get_storage().read_yaml(project.root_path, STATUS_FILE)
    if not data:
        return {t: False for t in VALID_TYPES}
    return {t: bool(data.get(t, False)) for t in VALID_TYPES}


@router.put("/status/{type}")
async def confirm_settings_type(
    project_id: str,
    type: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid settings type: {type}")

    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    data = await get_storage().read_yaml(project.root_path, STATUS_FILE) or {}
    data[type] = True
    await get_storage().write_yaml(project.root_path, STATUS_FILE, data)
    return {"ok": True, "type": type, "confirmed": True}
