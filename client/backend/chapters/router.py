from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth_local.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from novels.service import get_novel
from workflow.engine import _validate_ref, load_chapter, save_chapter, update_phase
from workflow.gates import gate_chapter_ready, gate_settings_complete

router = APIRouter(prefix="/api/novels/{project_id}", tags=["chapters"])


@router.get("/volumes")
async def list_volumes(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
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
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    result = await gate_settings_complete(project.root_path)
    # Soft gate: warn but do not block (gate_settings_complete returns hard_block=False)
    if result.hard_block and not result.valid:
        raise HTTPException(400, f"Settings incomplete: {result.warnings}")

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
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    data = await get_storage().read_yaml(project.root_path, f"volumes/{filename}")
    if not data:
        raise HTTPException(404, "Volume not found")
    return data


@router.put("/volumes/{filename}")
async def update_volume(
    project_id: str,
    filename: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    data = await get_storage().read_yaml(project.root_path, f"volumes/{filename}")
    if not data:
        raise HTTPException(404, "Volume not found")
    for k in ("title", "summary", "chapters"):
        if k in body:
            data[k] = body[k]
    await get_storage().write_yaml(project.root_path, f"volumes/{filename}", data)
    return {"ok": True}


@router.delete("/volumes/{filename}")
async def delete_volume(
    project_id: str,
    filename: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    data = await get_storage().read_yaml(project.root_path, f"volumes/{filename}")
    if not data:
        raise HTTPException(404, "Volume not found")
    await get_storage().delete_file(project.root_path, f"volumes/{filename}")
    return {"ok": True}


@router.post("/chapters")
async def create_chapter(
    project_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    vol = body.get("volume", 1)
    ch = body.get("chapter", 1)
    title = body.get("title", f"第{ch}章")
    chapter_ref = f"vol-{vol}-ch-{ch}"

    # Create chapter file with template defaults
    chapter_data = {
        "volume": vol,
        "chapter": ch,
        "title": title,
        "status": "outline",
        "outline": {
            "summary": "",
            "key_points": [],
            "characters": [],
            "location": "",
            "time": "",
            "narrative_pov": "",
        },
        "memo": {
            "current_task": "",
            "reader_expectation": {"state": "", "strategy": "", "detail": ""},
            "payoff_plan": {"must_resolve": [], "must_hold": [], "partial_advance": []},
            "downtime_functions": [],
            "key_choices": [],
            "required_changes": [],
            "prohibitions": [],
        },
        "segments": [],
    }
    await get_storage().write_yaml(
        project.root_path, f"chapters/{chapter_ref}.yaml", chapter_data
    )

    # Update volume chapter list
    vol_filename = f"vol-{vol}.yaml"
    vol_data = await get_storage().read_yaml(
        project.root_path, f"volumes/{vol_filename}"
    )
    if vol_data is None:
        vol_data = {
            "volume": vol,
            "title": f"Volume {vol}",
            "summary": "",
            "chapters": [],
        }
    if "chapters" not in vol_data or vol_data["chapters"] is None:
        vol_data["chapters"] = []
    vol_data["chapters"].append(
        {"chapter": ch, "title": title, "word_count": 0, "status": "outline"}
    )
    await get_storage().write_yaml(
        project.root_path, f"volumes/{vol_filename}", vol_data
    )

    project.total_chapters = (project.total_chapters or 0) + 1
    await db.commit()
    return {"chapter_ref": chapter_ref}


@router.delete("/chapters/{chapter_ref}")
async def delete_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    await get_storage().delete_file(project.root_path, f"chapters/{chapter_ref}.yaml")
    # Remove from volume chapter list
    parts = chapter_ref.split("-")
    vol = int(parts[1])
    ch = int(parts[3])
    vol_filename = f"vol-{vol}.yaml"
    vol_data = await get_storage().read_yaml(
        project.root_path, f"volumes/{vol_filename}"
    )
    if vol_data and "chapters" in vol_data:
        vol_data["chapters"] = [
            c for c in vol_data["chapters"] if c.get("chapter") != ch
        ]
        await get_storage().write_yaml(
            project.root_path, f"volumes/{vol_filename}", vol_data
        )
    return {"ok": True}


@router.get("/chapters/{chapter_ref}")
async def get_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
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
    project = await get_novel(db, project_id, user["id"])
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
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    chapter = await load_chapter(project.root_path, chapter_ref)
    result = gate_chapter_ready(chapter)
    if not result.valid:
        raise HTTPException(400, f"Chapter not ready: {result.warnings}")
    chapter["status"] = "confirmed"
    await get_storage().write_yaml(
        project.root_path, f"chapters/{chapter_ref}.yaml", chapter
    )
    # Also update volume chapter list status
    parts = chapter_ref.split("-")
    vol = int(parts[1])
    ch = int(parts[3])
    vol_filename = f"vol-{vol}.yaml"
    vol_data = await get_storage().read_yaml(
        project.root_path, f"volumes/{vol_filename}"
    )
    if vol_data and "chapters" in vol_data:
        for c in vol_data["chapters"]:
            if c.get("chapter") == ch:
                c["status"] = "confirmed"
        await get_storage().write_yaml(
            project.root_path, f"volumes/{vol_filename}", vol_data
        )
    return {"ok": True, "status": "confirmed"}
