import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from auth_local.deps import require_ai_access
from auth_local.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from novels.service import get_novel
from workflow.engine import _validate_ref, load_chapter, update_phase
from write.auxiliary import expand_text, polish_text, stream_continue
from write.quality import run_quality_checks
from write.stream import stream_segment

router = APIRouter(
    prefix="/api/novels/{project_id}/chapters/{chapter_ref}/write",
    tags=["write"],
)


@router.get("/stream/{seg}")
async def write_stream(
    project_id: str,
    chapter_ref: str,
    seg: int,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
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
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    full_text = body.get("full_text", "")
    chapter = await load_chapter(project.root_path, chapter_ref)
    results = await run_quality_checks(project.root_path, full_text)

    chapter["quality_check"] = results
    await get_storage().write_yaml(
        project.root_path, f"chapters/{chapter_ref}.yaml", chapter
    )

    return results


async def _stream_chapter(db, project, root_path: str, chapter_ref: str, ctx, prompt: str):
    """Generate chapter text via AI streaming, save on completion (BE-01: 写完刷新 DB 元数据)."""
    from ai_client import get_ai_client
    from chapters.service import refresh_chapter_meta
    from workflow.engine import load_chapter

    client = await get_ai_client()
    model = (
        ctx.style_setting.get("writing_model", "haiku")
        if hasattr(ctx, "style_setting")
        else "haiku"
    )
    role = (
        ctx.style_setting.get("role", "一位小说家")
        if hasattr(ctx, "style_setting")
        else "一位小说家"
    )
    full_text = ""

    async for event in client.chat_stream(
        model=model,
        system=role,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8192,
    ):
        if event.text:
            full_text += event.text
            yield f"data: {json.dumps({'type': 'chunk', 'text': event.text}, ensure_ascii=False)}\n\n"
        elif event.is_done:
            chapter = await load_chapter(root_path, chapter_ref)
            chapter["prose"] = full_text
            await get_storage().write_yaml(
                root_path, f"chapters/{chapter_ref}.yaml", chapter
            )
            # 双写第二步：以 YAML 为准刷新 DB 元数据（word_count/has_prose/outline_status）
            await refresh_chapter_meta(db, project, chapter_ref, chapter)
            yield f"data: {json.dumps({'type': 'done', 'full_text': full_text, 'tokens': event.tokens}, ensure_ascii=False)}\n\n"
        elif event.error:
            yield f"data: {json.dumps({'type': 'error', 'error': event.error}, ensure_ascii=False)}\n\n"


@router.post("/write")
async def write_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    """Stream an AI-written chapter based on all context data."""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    from write.chapter_writer import build_chapter_context

    ctx = await build_chapter_context(project.root_path, chapter_ref, project.name)
    prompt = ctx.to_prompt()

    # Save prompt for review
    await get_storage().write_md(
        project.root_path, f"prompts/{chapter_ref}-write-prompt.md", prompt
    )

    update_phase(project, "write")
    await db.commit()

    return StreamingResponse(
        _stream_chapter(db, project, project.root_path, chapter_ref, ctx, prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/continue")
async def continue_writing(
    project_id: str,
    chapter_ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    """Stream continuation text from a cursor position."""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    cursor_position = body.get("cursor_position", -1)
    if cursor_position < 0:
        raise HTTPException(400, "cursor_position is required and must be >= 0")

    return StreamingResponse(
        stream_continue(db, project, project.root_path, chapter_ref, cursor_position),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/polish")
async def polish_writing(
    project_id: str,
    chapter_ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    """Polish selected text (non-streaming)."""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    selected_text = body.get("selected_text", "")
    if not selected_text:
        raise HTTPException(400, "selected_text is required")
    context_before = body.get("context_before", "")
    context_after = body.get("context_after", "")
    surrounding_context = (context_before + "\n" + context_after).strip()

    text = await polish_text(
        project.root_path, chapter_ref, selected_text, surrounding_context
    )
    return {"polished_text": text}


@router.post("/expand")
async def expand_writing(
    project_id: str,
    chapter_ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    """Expand selected text (non-streaming)."""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    selected_text = body.get("selected_text", "")
    if not selected_text:
        raise HTTPException(400, "selected_text is required")
    context_before = body.get("context_before", "")
    context_after = body.get("context_after", "")
    surrounding_context = (context_before + "\n" + context_after).strip()

    text = await expand_text(
        project.root_path, chapter_ref, selected_text, surrounding_context
    )
    return {"expanded_text": text}
