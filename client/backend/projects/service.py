import os
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import DATA_ROOT
from filesystem.storage import get_storage
from models.project import Project


def slugify(name: str) -> str:
    slug = re.sub(r"[^\w\-]", "-", name.lower()).strip("-")
    return slug or "untitled"


async def create_project(
    db: AsyncSession,
    user_id: str,
    name: str,
    synopsis: str = "",
    genre_profile: str = "",
) -> Project:
    slug = slugify(name)
    existing = await db.execute(
        select(Project).where(Project.user_id == user_id, Project.slug == slug)
    )
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    root_path = f"{DATA_ROOT}/{slug}"
    await get_storage().init_skeleton(root_path)

    # Write AI-suggested metadata into project files
    if synopsis or genre_profile:
        story = await get_storage().read_yaml(root_path, "story.yaml")
        if synopsis:
            story["synopsis"] = synopsis
        await get_storage().write_yaml(root_path, "story.yaml", story)

    if genre_profile:
        style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")
        style["genre_profile"] = genre_profile
        await get_storage().write_yaml(root_path, "settings/writing-style.yaml", style)

    # Pre-fill world-setting with AI if synopsis is available
    if synopsis:
        try:
            from ai_prefill import prefill_world_setting

            await prefill_world_setting(root_path)
        except Exception:
            pass  # Non-blocking — create_project succeeds even if AI prefill fails

    project = Project(user_id=user_id, name=name, slug=slug, root_path=root_path)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def list_projects(db: AsyncSession, user_id: str) -> list[Project]:
    stmt = select(Project).where(Project.status != "deleted")
    if not os.environ.get("DEV_MODE"):
        stmt = stmt.where(Project.user_id == user_id)
    result = await db.execute(stmt.order_by(Project.updated_at.desc()))
    return list(result.scalars().all())


async def get_project(
    db: AsyncSession, project_id: str, user_id: str | None = None
) -> Project | None:
    stmt = select(Project).where(Project.id == project_id)
    if user_id and not os.environ.get("DEV_MODE"):
        stmt = stmt.where(Project.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_project_by_slug(
    db: AsyncSession, user_id: str, slug: str
) -> Project | None:
    stmt = select(Project).where(
        Project.slug == slug,
        Project.status != "deleted",
    )
    if not os.environ.get("DEV_MODE"):
        stmt = stmt.where(Project.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_project(db: AsyncSession, project: Project):
    project.status = "deleted"
    await db.commit()


# ── Serialization ─────────────────────────────────────────────────────────


def project_to_dict(p) -> dict:
    """Convert a Project ORM instance to a serializable dict."""
    return {
        "id": str(p.id),
        "name": p.name,
        "slug": p.slug,
        "current_phase": p.current_phase,
        "status": p.status,
        "total_volumes": p.total_volumes,
        "total_chapters": p.total_chapters,
        "total_archives": p.total_archives,
        "ai_config_id": str(p.ai_config_id) if p.ai_config_id else None,
        "ai_model": p.ai_model,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
