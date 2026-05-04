from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from archive.service import archive_chapter
from auth.middleware import get_current_user
from db import get_db
from projects.service import get_project
from workflow.engine import update_phase

router = APIRouter(
    prefix="/api/projects/{project_id}/chapters/{chapter_ref}/archive",
    tags=["archive"],
)


@router.post("")
async def archive(
    project_id: str,
    chapter_ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    full_text = body.get("full_text", "")
    if len(full_text) < 100:
        raise HTTPException(400, "Text too short to archive")

    result = archive_chapter(project.root_path, chapter_ref, full_text)
    update_phase(project, "archive")
    project.total_archives += 1
    await db.commit()

    return result
