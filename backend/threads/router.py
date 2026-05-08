from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project

router = APIRouter(prefix="/api/projects/{project_id}/threads", tags=["threads"])


@router.get("")
async def get_threads(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    return await get_storage().read_yaml(project.root_path, "threads.yaml")
