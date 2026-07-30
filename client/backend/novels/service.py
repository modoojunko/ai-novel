import os
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import DATA_ROOT
from filesystem.storage import get_storage
from models.project import Novel


def slugify(name: str) -> str:
    slug = re.sub(r"[^\w\-]", "-", name.lower()).strip("-")
    return slug or "untitled"


async def create_project(
    db: AsyncSession,
    user_id: str,
    name: str,
    synopsis: str = "",
    genre_profile: str = "",
    source: str = "ai",
) -> Novel:
    slug = slugify(name)
    existing = await db.execute(
        select(Novel).where(Novel.user_id == user_id, Novel.slug == slug)
    )
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    root_path = f"{DATA_ROOT}/{slug}"

    # "import" 来源：只创建数据库记录，不初始化文件系统骨架
    # 导入后文件系统会由 /import/persist 写入完整内容
    if source != "import":
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

    project = Novel(
        user_id=user_id,
        name=name,
        slug=slug,
        root_path=root_path,
        source=source,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def list_projects(db: AsyncSession, user_id: str) -> list[Novel]:
    stmt = select(Novel).where(Novel.status != "deleted")
    if not os.environ.get("DEV_MODE"):
        stmt = stmt.where(Novel.user_id == user_id)
    result = await db.execute(stmt.order_by(Novel.updated_at.desc()))
    return list(result.scalars().all())


async def get_novel(
    db: AsyncSession, project_id: str, user_id: str | None = None
) -> Novel | None:
    stmt = select(Novel).where(Novel.id == project_id)
    if user_id and not os.environ.get("DEV_MODE"):
        stmt = stmt.where(Novel.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_project_by_slug(
    db: AsyncSession, user_id: str, slug: str
) -> Novel | None:
    stmt = select(Novel).where(
        Novel.slug == slug,
        Novel.status != "deleted",
    )
    if not os.environ.get("DEV_MODE"):
        stmt = stmt.where(Novel.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_project(db: AsyncSession, project: Novel):
    project.status = "deleted"
    await db.commit()


# ── Serialization ─────────────────────────────────────────────────────────


def novel_to_dict(p) -> dict:
    """Convert a Novel ORM instance to a serializable dict."""
    return {
        "id": str(p.id),
        "name": p.name,
        "slug": p.slug,
        "current_phase": p.current_phase,
        "status": p.status,
        "total_volumes": p.total_volumes,
        "total_chapters": p.total_chapters,
        "total_archives": p.total_archives,
        "source": p.source,
        "ai_config_id": str(p.ai_config_id) if p.ai_config_id else None,
        "ai_model": p.ai_model,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ── Project Tree ────────────────────────────────────────────────────────────


async def build_project_tree(project_id: str, root_path: str) -> dict:
    """Build the full project tree: settings + volumes + chapters with status."""
    storage = get_storage()

    # Volumes
    files = await storage.list_dir(root_path, "volumes")
    volumes = []
    for f in sorted(files):
        if f.endswith(".yaml"):
            data = await storage.read_yaml(root_path, f"volumes/{f}")
            chapters = []
            for ch in data.get("chapters") or []:
                chapters.append(
                    {
                        "ref": f"vol-{data['volume']}-ch-{ch['chapter']}",
                        "volume": ch.get("volume"),
                        "chapter": ch.get("chapter"),
                        "title": ch.get("title", ""),
                        "status": ch.get("status", "outline"),
                        "word_count": len(ch.get("prose", "")),
                    }
                )
            volumes.append(
                {
                    "ref": f.replace(".yaml", ""),
                    "title": data.get("title", f),
                    "summary": data.get("summary", ""),
                    "chapter_count": len(chapters),
                    "chapters": chapters,
                }
            )

    return {
        "project_id": project_id,
        "volumes": volumes,
    }
