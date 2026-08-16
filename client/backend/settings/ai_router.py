"""AI-assisted settings generation endpoints."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ai_client import get_ai_client
from auth_local.deps import require_ai_access
from auth_local.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from novels.service import get_novel
from prompts import load as load_prompt

router = APIRouter(prefix="/api/novels/{project_id}/settings", tags=["settings-ai"])

# Only these types get per-field generation (anti-ai excluded)
FIELD_GENERATABLE = {"world", "style", "hooks", "characters"}


@router.post("/ai/{stype}/{field}")
async def generate_field(
    project_id: str,
    stype: str,
    field: str,
    body: dict,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    """Generate a single settings field."""
    if stype not in FIELD_GENERATABLE:
        raise HTTPException(400, f"Field generation not supported for: {stype}")

    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    story = await get_storage().read_yaml(project.root_path, "story.yaml") or {}
    premise = story.get("synopsis", "")
    if not premise:
        raise HTTPException(400, "No story premise found.")

    prompt_template = load_prompt(f"settings_{stype}")
    context = body.get("context", {})
    formatted_prompt = prompt_template.format(
        premise=premise, context=json.dumps(context, ensure_ascii=False)
    )
    client = await get_ai_client()

    try:
        usage: dict = {}
        text = await client.chat(
            model="haiku",
            system="你是小说设定专家。只输出 JSON，不要任何其他文字。",
            messages=[{"role": "user", "content": formatted_prompt}],
            max_tokens=1024,
            usage=usage,
        )
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {e!s}")

    from api_configs.usage import record_usage

    await record_usage(
        db,
        user_id=user["id"],
        project_id=project.id,
        operation=f"settings_{stype}",
        model="haiku",
        tokens_in=usage.get("tokens_in", 0),
        tokens_out=usage.get("tokens_out", 0),
    )

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0]
    try:
        value = json.loads(cleaned.strip())
    except ValueError as e:
        raise HTTPException(500, f"AI returned invalid JSON: {e}")
    return {"value": value}
