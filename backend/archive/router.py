import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from archive.service import archive_chapter
from auth.middleware import get_current_user
from billing.service import log_token_usage
from db import get_db
from filesystem.reader import read_md
from projects.service import get_project
from workflow.engine import update_phase

router = APIRouter(
    prefix="/api/projects/{project_id}/chapters/{chapter_ref}/archive",
    tags=["archive"],
)

archives_router = APIRouter(
    prefix="/api/projects/{project_id}/archives",
    tags=["archives"],
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

    usage = result.get("usage", {})
    if usage:
        await log_token_usage(
            db,
            user["id"],
            str(project.id),
            chapter_ref,
            "archive_summary",
            "haiku",
            usage["input_tokens"],
            usage["output_tokens"],
        )

    await db.commit()

    return result


@archives_router.get("")
async def list_archives(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    archive_dir = os.path.join(project.root_path, "archives")
    if not os.path.exists(archive_dir):
        return []
    files = sorted(os.listdir(archive_dir), reverse=True)
    return [
        {"filename": f, "path": f"archives/{f}"} for f in files if f.endswith(".md")
    ]


@archives_router.get("/{filename}")
async def get_archive(
    project_id: str,
    filename: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    content = read_md(project.root_path, f"archives/{filename}")
    if not content:
        raise HTTPException(404, "Archive not found")
    return {"filename": filename, "content": content}
