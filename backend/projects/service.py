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
    db: AsyncSession, user_id: str, name: str,
    synopsis: str = "", genre_profile: str = "",
) -> Project:
    slug = slugify(name)
    existing = await db.execute(
        select(Project).where(Project.user_id == user_id, Project.slug == slug)
    )
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    root_path = f"{DATA_ROOT}/{user_id}/{slug}"
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

    project = Project(user_id=user_id, name=name, slug=slug, root_path=root_path)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def list_projects(db: AsyncSession, user_id: str) -> list[Project]:
    result = await db.execute(
        select(Project)
        .where(Project.user_id == user_id, Project.status != "deleted")
        .order_by(Project.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_project(
    db: AsyncSession, project_id: str, user_id: str | None = None
) -> Project | None:
    stmt = select(Project).where(Project.id == project_id)
    if user_id:
        stmt = stmt.where(Project.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_project_by_slug(
    db: AsyncSession, user_id: str, slug: str
) -> Project | None:
    result = await db.execute(
        select(Project).where(
            Project.user_id == user_id,
            Project.slug == slug,
            Project.status != "deleted",
        )
    )
    return result.scalar_one_or_none()


async def delete_project(db: AsyncSession, project: Project):
    project.status = "deleted"
    await db.commit()
