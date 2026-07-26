from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth_local.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project
from workflow.engine import update_phase
from workflow.gates import gate_chapter_ready

router = APIRouter(prefix="/api/projects/{project_id}/workflow", tags=["workflow"])


@router.post("/transition")
async def transition_workflow(
    project_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    target = body.get("target")
    if not target:
        raise HTTPException(400, "target is required")

    if target == "prompt":
        # Load all chapters and check each one
        files = await get_storage().list_dir(project.root_path, "chapters")
        failures = []
        for f in sorted(files):
            if not f.endswith(".yaml"):
                continue
            ref = f.replace(".yaml", "")
            chapter = await get_storage().read_yaml(project.root_path, f"chapters/{f}")
            if not chapter:
                continue
            ok, missing = gate_chapter_ready(chapter)
            if not ok:
                failures.append({"chapter_ref": ref, "missing": missing})

        if failures:
            raise HTTPException(
                400,
                f"Some chapters are not ready: {failures}",
            )

        update_phase(project, "prompt")
        await db.commit()
        return {"ok": True, "phase": project.current_phase}

    raise HTTPException(400, f"Unsupported target: {target}")
