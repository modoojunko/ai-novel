import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ai_client import get_ai_client
from auth.middleware import get_current_user
from config import AI_API_KEY
from db import get_db
from projects.service import (
    create_project,
    delete_project,
    get_project,
    get_project_by_slug,
    list_projects,
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
    db: AsyncSession = Depends(get_db),
):
    project = await create_project(
        db, user["id"], body.name,
        synopsis=body.synopsis,
        genre_profile=body.genre_profile,
    )
    return _project_dict(project)


@ai_router.post("/suggest-meta")
async def suggest_meta(
    body: SuggestMetaBody,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Given a story premise, suggest titles, synopsis, genre, and pen name."""
    if not AI_API_KEY:
        raise HTTPException(503, "AI service not configured")

    prompt = f"""你是一位资深出版编辑。一位作者想写一本小说，给了你下面这段话描述ta的故事构思。请根据这个构思给出以下建议，用 JSON 格式返回（不要额外文本）。

故事构思：
{body.premise}

返回格式：
{{
  "titles": ["书名选项1", "书名选项2", "书名选项3"],
  "synopsis": "一段 80-120 字的简介，适合放在小说封面或简介区",
  "genre_profile": "suspense-crime|urban-romance|ancient-politics|scifi-apocalypse|xuanhuan|xianxia|western-fantasy|urban-daily 中的一个",
  "genre_label": "类型的中文名称",
  "atmosphere": "一句话描述这本书的氛围（如：压抑紧绷的暗流涌动 / 轻松温暖的都市日常）"
}}

要求：
- 书名要有冲击力，不是烂大街的名字。每本书名 ≤8 字
- 简介要用大白话，不是文学评论腔。直接讲这个故事关于什么，不写"这是一个关于…的故事"
- 类型判断要准确——如果提到探案/悬疑/失踪 → suspense-crime；如果提到修真/修炼/境界 → xianxia 或 xuanhuan
- 如果无法确定类型，默认选 urban-daily"""

    client = get_ai_client()
    try:
        text = await client.chat(
            model="haiku",
            system="",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
        )
        # Extract JSON from response (handle ```json fences)
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e:
        raise HTTPException(500, f"AI suggestion failed: {str(e)}")


@router.get("")
async def list_all(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    projects = await list_projects(db, user["id"])
    return [_project_dict(p) for p in projects]


@router.get("/by-slug/{slug}")
async def get_one_by_slug(
    slug: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_by_slug(db, user["id"], slug)
    if not project:
        raise HTTPException(404, "Project not found")
    return _project_dict(project)


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
