import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from config import ANTHROPIC_API_KEY
from db import get_db
from filesystem.reader import read_md
from filesystem.writer import write_yaml
from projects.service import get_project
from prompt.assembler import assemble_all_segments
from workflow.engine import load_chapter, update_phase

router = APIRouter(
    prefix="/api/projects/{project_id}/chapters/{chapter_ref}",
    tags=["prompts"],
)


@router.post("/perspective")
async def run_perspective_conversion(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    chapter = load_chapter(project.root_path, chapter_ref)
    summary = chapter.get("outline", {}).get("summary", "")
    pov = chapter.get("pov_character", "主角")

    import anthropic

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system="将以下上帝视角章纲转换为沉浸式写作指引。用第二人称'你'。保留所有关键事件，但用感官细节替换概括性描述。200-300字。",
        messages=[{"role": "user", "content": f"视角：{pov}\n章纲：{summary}"}],
    )
    guidance = message.content[0].text

    chapter["outline"]["perspective_guidance"] = guidance
    write_yaml(project.root_path, f"chapters/{chapter_ref}.yaml", chapter)

    return {
        "guidance": guidance,
        "tokens_used": message.usage.input_tokens + message.usage.output_tokens,
    }


@router.get("/prompts")
async def list_prompts(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    prompt_dir = os.path.join(project.root_path, "prompts")
    if not os.path.exists(prompt_dir):
        return []
    return sorted([f for f in os.listdir(prompt_dir) if f.startswith(chapter_ref)])


@router.post("/prompts/generate")
async def generate_prompts(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    paths = assemble_all_segments(project.root_path, chapter_ref, project.name)
    update_phase(project, "prompt")
    await db.commit()
    return {"prompts": paths}


@router.get("/prompts/{seg}")
async def get_prompt_content(
    project_id: str,
    chapter_ref: str,
    seg: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    content = read_md(
        project.root_path, f"prompts/{chapter_ref}-{seg}-prompt.md"
    )
    return PlainTextResponse(content)
