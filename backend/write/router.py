from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project
from workflow.engine import _validate_ref, load_chapter, update_phase
from write.quality import run_quality_checks
from write.stream import stream_segment

router = APIRouter(
    prefix="/api/projects/{project_id}/chapters/{chapter_ref}/write",
    tags=["write"],
)


@router.get("/stream/{seg}")
async def write_stream(
    project_id: str,
    chapter_ref: str,
    seg: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    prompt_content = await get_storage().read_md(
        project.root_path, f"prompts/{chapter_ref}-seg-{seg}-prompt.md"
    )
    if not prompt_content:
        raise HTTPException(400, "Prompt not found. Generate prompts first.")

    update_phase(project, "write")
    await db.commit()

    return StreamingResponse(
        stream_segment(project.root_path, chapter_ref, seg),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/quality-check")
async def quality_check(
    project_id: str,
    chapter_ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    full_text = body.get("full_text", "")
    chapter = await load_chapter(project.root_path, chapter_ref)
    results = await run_quality_checks(project.root_path, chapter, full_text)

    chapter["quality_check"] = results
    await get_storage().write_yaml(
        project.root_path, f"chapters/{chapter_ref}.yaml", chapter
    )

    return results
