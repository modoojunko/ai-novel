from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project
from workflow.engine import _validate_ref, load_chapter, save_chapter, update_phase
from workflow.gates import gate_chapter_ready, gate_settings_complete

router = APIRouter(prefix="/api/projects/{project_id}", tags=["chapters"])


@router.get("/volumes")
async def list_volumes(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    files = await get_storage().list_dir(project.root_path, "volumes")
    vols = []
    for f in sorted(files):
        if f.endswith(".yaml"):
            vols.append({"filename": f, "name": f.replace(".yaml", "")})
    return vols


@router.post("/volumes")
async def create_volume(
    project_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    ok, missing = await gate_settings_complete(project.root_path)
    if not ok:
        raise HTTPException(400, f"Settings incomplete: {missing}")

    update_phase(project, "outline")
    vol_num = body.get("vol_num", project.total_volumes + 1)
    await get_storage().write_yaml(
        project.root_path,
        f"volumes/vol-{vol_num}.yaml",
        {
            "volume": vol_num,
            "title": body.get("title", f"Volume {vol_num}"),
            "summary": "",
            "chapters": [],
        },
    )
    project.total_volumes = vol_num
    await db.commit()
    return {"vol_num": vol_num, "filename": f"vol-{vol_num}.yaml"}


@router.get("/volumes/{filename}")
async def get_volume(
    project_id: str,
    filename: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    data = await get_storage().read_yaml(project.root_path, f"volumes/{filename}")
    if not data:
        raise HTTPException(404, "Volume not found")
    return data


@router.get("/chapters/{chapter_ref}")
async def get_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    data = await load_chapter(project.root_path, chapter_ref)
    if not data:
        raise HTTPException(404, "Chapter not found")
    return data


@router.put("/chapters/{chapter_ref}")
async def update_chapter(
    project_id: str,
    chapter_ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    await save_chapter(project.root_path, chapter_ref, body)
    return {"ok": True}


@router.post("/chapters/{chapter_ref}/confirm")
async def confirm_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    chapter = await load_chapter(project.root_path, chapter_ref)
    ok, missing = gate_chapter_ready(chapter)
    if not ok:
        raise HTTPException(400, f"Chapter not ready: {missing}")
    update_phase(project, "prompt")
    await db.commit()
    return {"ok": True, "phase": project.current_phase}
