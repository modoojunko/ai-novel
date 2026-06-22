from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from db import get_db
from novel.service import build_project_tree
from projects.service import get_project

router = APIRouter(prefix="/api/projects/{project_id}", tags=["novel"])


@router.get("/tree")
async def get_project_tree(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    tree = await build_project_tree(project_id, project.root_path)
    return tree
