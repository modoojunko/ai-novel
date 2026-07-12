"""AI-assisted settings generation endpoints."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ai_client import get_ai_client
from auth.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project
from prompts import load as load_prompt

router = APIRouter(prefix="/api/projects/{project_id}/settings", tags=["settings-ai"])

VALID_TYPES = {"world", "style", "anti-ai", "hooks", "characters"}
# Only these types get per-field generation (anti-ai excluded)
FIELD_GENERATABLE = {"world", "style", "hooks", "characters"}


@router.post("/generate")
async def generate_all_settings(
    project_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate all setting types from premise in one call."""
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    types = body.get("types", list(VALID_TYPES))
    invalid = [t for t in types if t not in VALID_TYPES]
    if invalid:
        raise HTTPException(400, f"Invalid types: {invalid}")

    # Load premise
    story = await get_storage().read_yaml(project.root_path, "story.yaml") or {}
    premise = story.get("synopsis", "")
    if not premise:
        raise HTTPException(400, "No story premise found. Create the project with a story description first.")

    client = get_ai_client()
    results = {}

    for t in types:
        prompt = load_prompt(f"settings_{t}")
        try:
            text = await client.chat(
                model="haiku",
                system="你是小说设定专家。只输出 JSON，不要任何其他文字。",
                messages=[{"role": "user", "content": prompt.format(premise=premise, context="{}")}],
                max_tokens=2048,
            )
            # Parse JSON from response (handle markdown-wrapped JSON)
            cleaned = text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
                cleaned = cleaned.rsplit("```", 1)[0]
            results[t] = json.loads(cleaned.strip())
        except Exception as e:
            results[t] = {"_error": str(e)}

    return results


@router.post("/ai/{stype}/{field}")
async def generate_field(
    project_id: str,
    stype: str,
    field: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a single settings field."""
    if stype not in FIELD_GENERATABLE:
        raise HTTPException(400, f"Field generation not supported for: {stype}")

    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    story = await get_storage().read_yaml(project.root_path, "story.yaml") or {}
    premise = story.get("synopsis", "")
    if not premise:
        raise HTTPException(400, "No story premise found.")

    prompt_template = load_prompt(f"settings_{stype}")
    context = body.get("context", {})
    formatted_prompt = prompt_template.format(premise=premise, context=json.dumps(context, ensure_ascii=False))
    client = get_ai_client()

    try:
        text = await client.chat(
            model="haiku",
            system="你是小说设定专家。只输出 JSON，不要任何其他文字。",
            messages=[{"role": "user", "content": formatted_prompt}],
            max_tokens=1024,
        )
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
            cleaned = cleaned.rsplit("```", 1)[0]
        value = json.loads(cleaned.strip())
        return {"value": value}
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {str(e)}")
