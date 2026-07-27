import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ai_client import get_ai_client
from auth_local.deps import require_ai_access, require_project_limit
from auth_local.middleware import get_current_user
from auth_local.service import get_local_config
from db import get_db
from projects.service import (
    create_project,
    delete_project,
    get_project,
    get_project_by_slug,
    list_projects,
    project_to_dict,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])

ai_router = APIRouter(prefix="/api/ai", tags=["ai"])


class CreateProjectBody(BaseModel):
    name: str
    synopsis: str = ""
    genre_profile: str = ""


class SuggestMetaBody(BaseModel):
    premise: str


GENRE_CORPUS_NAMES = {
    "suspense-crime": "悬疑刑侦",
    "urban-romance": "都市言情",
    "ancient-politics": "古风权谋",
    "scifi-apocalypse": "科幻末世",
    "xuanhuan": "传统玄幻",
    "xianxia": "东方仙侠",
    "western-fantasy": "西方奇幻",
    "urban-daily": "都市日常",
}


@router.post("", status_code=201)
async def create(
    body: CreateProjectBody,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
    _limit: bool = Depends(require_project_limit),
):
    project = await create_project(
        db,
        user["id"],
        body.name,
        synopsis=body.synopsis,
        genre_profile=body.genre_profile,
    )
    return project_to_dict(project)


@ai_router.post("/suggest-meta")
async def suggest_meta(
    body: SuggestMetaBody,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
    _limit: bool = Depends(require_project_limit),
):
    """Given a story premise, suggest titles, synopsis, genre, and pen name."""
    cfg = get_local_config()
    if not cfg.get("api_key"):
        raise HTTPException(
            503, "AI service not configured — go to Settings to set your API Key"
        )

    from prompts import load as load_prompt

    prompt = load_prompt("suggest_meta").format(premise=body.premise)

    client = await get_ai_client()

    try:
        text = await client.chat(
            model="haiku",
            system="",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
        )
        # Extract JSON from response (handle ```json fences)
        if "```" in text:
            text = text.split("```")[1]
            text = text.removeprefix("json")
        return json.loads(text.strip())
    except ValueError as e:
        raise HTTPException(500, f"AI suggestion failed: {e!s}")


@router.get("")
async def list_all(
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
    _limit: bool = Depends(require_project_limit),
):
    projects = await list_projects(db, user["id"])
    return [project_to_dict(p) for p in projects]


@router.get("/by-slug/{slug}")
async def get_one_by_slug(
    slug: str,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
    _limit: bool = Depends(require_project_limit),
):
    project = await get_project_by_slug(db, user["id"], slug)
    if not project:
        raise HTTPException(404, "Project not found")
    return project_to_dict(project)


@router.get("/{project_id}")
async def get_one(
    project_id: str,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
    _limit: bool = Depends(require_project_limit),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    return project_to_dict(project)


@router.delete("/{project_id}")
async def delete(
    project_id: str,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
    _limit: bool = Depends(require_project_limit),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    await delete_project(db, project)
    return {"ok": True}

