from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from auth_local.middleware import get_current_user
from auth_local.deps import require_ai_access
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project
from prompt.assembler import assemble_all_segments
from workflow.engine import _validate_ref, load_chapter, update_phase

router = APIRouter(
    prefix="/api/projects/{project_id}/chapters/{chapter_ref}",
    tags=["prompts"],
)


@router.post("/perspective")
async def run_perspective_conversion(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    chapter = await load_chapter(project.root_path, chapter_ref)
    summary = chapter.get("outline", {}).get("summary", "")
    pov = chapter.get("pov_character", "主角")

    from ai_client import create_ai_client, resolve_model

    # C/S: Token tracking removed — user brings own API key
    client = create_ai_client()
    message = await client.messages.create(
        model=resolve_model("haiku"),
        max_tokens=500,
        system="将以下上帝视角章纲转换为沉浸式写作指引。用第二人称'你'。保留所有关键事件，但用感官细节替换概括性描述。200-300字。",
        messages=[{"role": "user", "content": f"视角：{pov}\n章纲：{summary}"}],
    )
    guidance = message.content[0].text

    # C/S: Token tracking removed — user brings own API key
    chapter["outline"]["perspective_guidance"] = guidance
    await get_storage().write_yaml(
        project.root_path, f"chapters/{chapter_ref}.yaml", chapter
    )

    return {
        "guidance": guidance,
        "tokens_used": message.usage.input_tokens + message.usage.output_tokens,
    }


@router.get("/prompts")
async def list_prompts(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    files = await get_storage().list_dir(project.root_path, "prompts")
    return sorted([f for f in files if f.startswith(chapter_ref)])


@router.post("/prompts/generate")
async def generate_prompts(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    paths = await assemble_all_segments(project.root_path, chapter_ref, project.name)
    update_phase(project, "prompt")
    await db.commit()
    return {"prompts": paths}


@router.get("/prompts/{seg}")
async def get_prompt_content(
    project_id: str,
    chapter_ref: str,
    seg: str,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    content = await get_storage().read_md(
        project.root_path, f"prompts/{chapter_ref}-{seg}-prompt.md"
    )
    return PlainTextResponse(content)
