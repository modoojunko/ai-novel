"""Chapter version management: list, restore."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth_local.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from novels.service import get_novel
from workflow.engine import _validate_ref, save_chapter

router = APIRouter(
    prefix="/api/novels/{project_id}/chapters/{chapter_ref}", tags=["versions"]
)


@router.get("/versions")
async def list_versions(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    files = await get_storage().list_dir(project.root_path, f"versions/{chapter_ref}")
    versions = []
    for f in sorted(files, reverse=True):
        if not f.endswith(".yaml"):
            continue
        data = await get_storage().read_yaml(
            project.root_path, f"versions/{chapter_ref}/{f}"
        )
        if data:
            versions.append(
                {
                    "version": data.get("version", f.replace(".yaml", "")),
                    "time": data.get("created_at", 0),
                    "comment": data.get("comment", ""),
                    "isCurrent": False,
                }
            )

    if versions:
        versions[0]["isCurrent"] = True

    return versions


@router.get("/versions/{version_id}/content")
async def get_version_content(
    project_id: str,
    chapter_ref: str,
    version_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    version_file = f"versions/{chapter_ref}/{version_id}.yaml"
    version_data = await get_storage().read_yaml(project.root_path, version_file)
    if not version_data:
        raise HTTPException(404, "Version not found")

    snapshot = version_data.get("snapshot", {})
    prose = snapshot.get("prose")
    if not prose:
        raise HTTPException(404, "Version not found")

    return {
        "version": version_data.get("version", version_id),
        "time": version_data.get("created_at", 0),
        "comment": version_data.get("comment", ""),
        "prose": prose,
    }


@router.post("/versions/{version_id}/restore")
async def restore_version(
    project_id: str,
    chapter_ref: str,
    version_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    version_file = f"versions/{chapter_ref}/{version_id}.yaml"
    version_data = await get_storage().read_yaml(project.root_path, version_file)
    if not version_data:
        raise HTTPException(404, "Version not found")

    snapshot = version_data.get("snapshot", {})
    if not snapshot:
        raise HTTPException(400, "Version has no snapshot data")

    chapter = (
        await get_storage().read_yaml(project.root_path, f"chapters/{chapter_ref}.yaml")
        or {}
    )
    chapter["prose"] = snapshot.get("prose", chapter.get("prose", ""))
    if "outline" in snapshot:
        chapter["outline"] = snapshot["outline"]
    if "status" in snapshot:
        chapter["status"] = snapshot["status"]

    await save_chapter(project.root_path, chapter_ref, chapter)
    # restore 后刷新 DB 元数据（BE-13）：回滚 prose/status 后 word_count/outline_status 需同步
    from chapters.service import refresh_chapter_meta

    await refresh_chapter_meta(db, project, chapter_ref, chapter)
    return {"ok": True, "restored": version_id}


@router.delete("/versions/{version_id}")
async def delete_version(
    project_id: str,
    chapter_ref: str,
    version_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    version_file = f"versions/{chapter_ref}/{version_id}.yaml"
    version_data = await get_storage().read_yaml(project.root_path, version_file)
    if not version_data:
        raise HTTPException(404, "Version not found")

    await get_storage().delete_file(project.root_path, version_file)
    return {"ok": True, "deleted": version_id}
