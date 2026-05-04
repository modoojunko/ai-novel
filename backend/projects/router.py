from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from db import get_db
from projects.service import (
    create_project,
    delete_project,
    get_project,
    list_projects,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectBody(BaseModel):
    name: str


@router.post("", status_code=201)
async def create(
    body: CreateProjectBody,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await create_project(db, user["id"], body.name)
    return _project_dict(project)


@router.get("")
async def list_all(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    projects = await list_projects(db, user["id"])
    return [_project_dict(p) for p in projects]


@router.get("/{project_id}")
async def get_one(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    return _project_dict(project)


@router.delete("/{project_id}")
async def delete(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    await delete_project(db, project)
    return {"ok": True}


def _project_dict(p) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "slug": p.slug,
        "current_phase": p.current_phase,
        "status": p.status,
        "total_volumes": p.total_volumes,
        "total_chapters": p.total_chapters,
        "total_archives": p.total_archives,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }
