import json
import os
import tempfile
import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_client import get_ai_client
from auth_local.deps import require_ai_access, require_project_limit
from auth_local.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from novels.importer import IMPORT_TEMPLATE_MD, parse_file
from novels.service import (
    build_project_tree,
    create_project,
    delete_project,
    get_novel,
    get_project_by_slug,
    list_projects,
    novel_to_dict,
    rename_project,
    slugify,
)
from workflow.readiness import compute_readiness

router = APIRouter(prefix="/api/novels", tags=["novels"])

ai_router = APIRouter(prefix="/api/ai", tags=["ai"])


class CreateProjectBody(BaseModel):
    name: str
    synopsis: str = ""
    genre_profile: str = ""
    source: str = "manual"


class SuggestMetaBody(BaseModel):
    premise: str


class RenameProjectBody(BaseModel):
    name: str


class UpdateStoryBody(BaseModel):
    synopsis: str = ""


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
    _limit: bool = Depends(require_project_limit),
):
    project = await create_project(
        db,
        user["id"],
        body.name,
        synopsis=body.synopsis,
        genre_profile=body.genre_profile,
        source=body.source,
    )
    return novel_to_dict(project)


@ai_router.post("/suggest-meta")
async def suggest_meta(
    body: SuggestMetaBody,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
    _limit: bool = Depends(require_project_limit),
):
    """Given a story premise, suggest titles, synopsis, genre, and pen name."""
    from prompts import load as load_prompt

    prompt = load_prompt("suggest_meta").format(premise=body.premise)

    # 新版 API Key 多配置：get_ai_client() 优先从 api_configs 表读取（解密），
    # config.json 仅作迁移期兜底；未配置 Key 时 AIClient 构造抛 ValueError。
    try:
        client = await get_ai_client()
    except ValueError as e:
        raise HTTPException(503, f"AI service not configured — {e}")

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
    db: AsyncSession = Depends(get_db),
):
    projects = await list_projects(db, user["id"])
    return [novel_to_dict(p) for p in projects]


@router.get("/by-slug/{slug}")
async def get_one_by_slug(
    slug: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_by_slug(db, user["id"], slug)
    if not project:
        raise HTTPException(404, "Novel not found")
    return novel_to_dict(project)


@router.get("/{project_id}")
async def get_one(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Novel not found")
    data = novel_to_dict(project)
    # BE-04：详情端点合并题材（project_settings KV + 全局 genres 表）；
    # KV 缺失/损坏 → genre/genre_name None，不 500（NovelBar 以 genre 优先于 type 展示）
    data["genre"] = None
    data["genre_name"] = None
    try:
        from models.genre import Genre
        from models.project_setting import ProjectSetting

        row = (
            await db.execute(
                select(ProjectSetting).where(
                    ProjectSetting.root_path == project.root_path,
                    ProjectSetting.key == "genre",
                )
            )
        ).scalar_one_or_none()
        if row is not None:
            cfg = json.loads(row.content)
            genre_id = cfg.get("genre_id")
            data["genre"] = genre_id
            if genre_id:
                g = (
                    await db.execute(select(Genre).where(Genre.id == genre_id))
                ).scalar_one_or_none()
                if g is not None:
                    data["genre_name"] = g.name
    except Exception:
        pass  # KV 缺失/损坏不 500
    return data


@router.patch("/{project_id}")
async def rename(
    project_id: str,
    body: RenameProjectBody,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename a novel (display name only — slug/root_path unchanged)."""
    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(422, "书名不能为空")
    if len(new_name) > 200:
        raise HTTPException(422, "书名过长")
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Novel not found")
    if new_name == project.name:
        return novel_to_dict(project)  # idempotent same-name save
    renamed = await rename_project(db, project, new_name)
    return novel_to_dict(renamed)


@router.get("/{project_id}/story")
async def get_story(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Read story.yaml (synopsis etc.) for the synopsis card."""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Novel not found")
    story = await get_storage().read_yaml(project.root_path, "story.yaml") or {}
    return {"synopsis": story.get("synopsis", "")}


@router.put("/{project_id}/story")
async def update_story(
    project_id: str,
    body: UpdateStoryBody,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Write story.yaml.synopsis (manual backfill — never triggers AI prefill)."""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Novel not found")
    story = await get_storage().read_yaml(project.root_path, "story.yaml") or {}
    story["synopsis"] = body.synopsis.strip()
    await get_storage().write_yaml(project.root_path, "story.yaml", story)
    return {"ok": True, "synopsis": body.synopsis.strip()}


@router.delete("/{project_id}")
async def delete(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Novel not found")
    await delete_project(db, project)
    return {"ok": True}


@router.get("/{project_id}/tree")
async def get_project_tree(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Novel not found")
    tree = await build_project_tree(db, project)
    return tree


@router.get("/{project_id}/readiness")
async def get_readiness(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """7 项内容就绪判定（PRD 3.4）：complete / missing[{key,label,jump}] / warning 中文。"""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Novel not found")
    return await compute_readiness(project.root_path)


@router.get("/{project_id}/export")
async def export_project(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """打包项目目录为 zip（卷章/设定/正文/版本快照全量），供备份/分享。"""
    project = await get_novel(db, project_id, user["id"])
    if not project or project.status == "deleted":
        raise HTTPException(404, "Novel not found")

    import io
    import zipfile

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, _dirs, files in os.walk(project.root_path):
            for fname in files:
                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, project.root_path)
                zf.write(full, rel)
    buffer.seek(0)

    # RFC 5987 编码中文文件名（slug 保留汉字，latin-1 header 会 UnicodeEncodeError）
    from urllib.parse import quote

    filename = f"{project.slug}.zip"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": (
                f"attachment; filename=export.zip; filename*=UTF-8''{quote(filename)}"
            )
        },
    )


# ── Import endpoints ───────────────────────────────────────────────────────────


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


class ChapterItem(BaseModel):
    title: str
    content: str


class VolumeItem(BaseModel):
    title: str
    chapters: list[ChapterItem]


class ImportPersistBody(BaseModel):
    name: str
    volumes: list[VolumeItem]


@router.post("/import/parse", status_code=200)
async def import_parse(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Parse an uploaded file and return structured volume/chapter data."""
    # Read content and enforce 10 MB limit
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "文件大小超过 10MB 限制")

    filename = file.filename or "upload.txt"
    ext = os.path.splitext(filename)[1].lower() or ".txt"

    # Write to temp file for parsing
    fd, tmp_path = tempfile.mkstemp(suffix=ext)
    try:
        os.write(fd, raw)
    finally:
        os.close(fd)

    try:
        result = parse_file(tmp_path, filename)
    finally:
        os.unlink(tmp_path)

    return {
        "volumes": [asdict(v) for v in result.volumes],
        "warnings": [asdict(w) for w in result.warnings],
        "title": result.title,
    }


@router.post("/import/persist", status_code=201)
async def import_persist(
    body: ImportPersistBody,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_project_limit),
):
    """Persist parsed volumes/chapters as a new novel project."""
    from config import DATA_ROOT
    from filesystem.init import SKELETON_DIRS
    from filesystem.storage import get_storage
    from models.project import Novel

    # ── Generate unique slug & root_path ──────────────────────────────
    slug = slugify(body.name)
    existing = await db.execute(
        select(Novel).where(Novel.user_id == user["id"], Novel.slug == slug)
    )
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    root_path = os.path.join(DATA_ROOT, slug)

    try:
        # ── 1. Create skeleton directories only ──────────────────────
        os.makedirs(root_path, exist_ok=True)
        for d in SKELETON_DIRS:
            os.makedirs(os.path.join(root_path, d), exist_ok=True)

        # ── 2. Write volumes & chapters ──────────────────────────────
        storage = get_storage()
        for vi, vol in enumerate(body.volumes, start=1):
            vol_data = {
                "volume": vi,
                "title": vol.title,
                "summary": "",
                "chapters": [],
            }
            for ci, ch in enumerate(vol.chapters, start=1):
                ch_data = {
                    "volume": vi,
                    "chapter": ci,
                    "title": ch.title,
                    "status": "draft",
                    "prose": ch.content,
                }
                vol_data["chapters"].append(ch_data)

                # ── 3. Write chapter file ────────────────────────────
                ch_ref = f"vol-{vi}-ch-{ci}"
                await storage.write_yaml(
                    root_path, f"chapters/{ch_ref}.yaml", ch_data
                )

                # ── 4. Write version snapshot ────────────────────────
                import time

                ts = int(time.time() * 1000)
                version_data = {
                    "version": f"v{ts}",
                    "chapter_ref": ch_ref,
                    "created_at": ts,
                    "comment": "导入初始版本",
                    "snapshot": {
                        "prose": ch.content,
                        "outline": {},
                        "status": "draft",
                    },
                }
                await storage.write_yaml(
                    root_path, f"versions/{ch_ref}/v{ts}.yaml", version_data
                )

            # Write volume file
            await storage.write_yaml(
                root_path, f"volumes/vol-{vi}.yaml", vol_data
            )

        # ── 5. Genre detection & synopsis extraction (free-tier) ─────
        try:
            # 从第一章正文匹配类型
            first_ch = body.volumes[0].chapters[0] if body.volumes else None
            if first_ch and first_ch.content:
                from novels.genre_matcher import extract_synopsis, match_genre

                synopsis = extract_synopsis(first_ch.content)
                genre, confidence = match_genre(first_ch.content)
                if genre:
                    await storage.write_yaml(
                        root_path,
                        "story.yaml",
                        {
                            "synopsis": synopsis,
                            "genre": genre,
                            "genre_confidence": confidence,
                            "genre_source": "auto_detect",
                        },
                    )
        except Exception:
            pass  # 非关键，失败不中断导入

        # ── 6. Create DB record ──────────────────────────────────────
        project = Novel(
            user_id=user["id"],
            name=body.name,
            slug=slug,
            root_path=root_path,
            source="import",
            total_volumes=len(body.volumes),
            total_chapters=sum(len(v.chapters) for v in body.volumes),
            # 同 create_project：导入即进入 settings 阶段，避免 init 下建卷 500
            current_phase="settings",
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)

        # ── 7. 卷/章入 DB 索引（导入即列表可用，不必等下次重启）──────
        try:
            from filesystem.index_volumes_chapters import reindex_project

            await reindex_project(str(project.id))
        except Exception as e:
            import logging

            logging.getLogger("uvicorn.error").warning(
                "reindex_project failed after import: %s", e
            )

        return {"id": str(project.id), "name": body.name}

    except Exception as e:
        # Clean up on failure
        import shutil

        if os.path.exists(root_path):
            shutil.rmtree(root_path)
        raise HTTPException(500, f"导入持久化失败: {e!s}")


@router.get("/import/template")
async def import_template():
    """Return the import template markdown for the "下载导入模板" link."""
    return Response(
        content=IMPORT_TEMPLATE_MD,
        media_type="text/markdown; charset=utf-8",
    )
