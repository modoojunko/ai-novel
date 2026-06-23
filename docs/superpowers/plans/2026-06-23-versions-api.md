# Versions API — Implementation Plan

**Files to create:**
- `backend/chapters/versions.py` — versions router with list + restore endpoints

**Files to modify:**
- `backend/workflow/engine.py` — add snapshot logic in `save_chapter()`
- `backend/main.py` — register versions router
- `frontend/src/components/novel/VersionHistory.tsx` — wire to real API

## Tasks

### Task 1: Add version snapshot to save_chapter

In `backend/workflow/engine.py`, modify `save_chapter()`:

```python
async def save_chapter(root_path: str, chapter_ref: str, data: dict):
    """Save chapter data and create a version snapshot."""
    old_data = await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml")
    await get_storage().write_yaml(root_path, f"chapters/{chapter_ref}.yaml", data)
    
    # Create version snapshot if content actually changed
    if old_data:
        old_prose = old_data.get("prose", "")
        new_prose = data.get("prose", "")
        old_outline = old_data.get("outline", {}).get("summary", "")
        new_outline = data.get("outline", {}).get("summary", "")
        
        if old_prose != new_prose or old_outline != new_outline:
            import time
            timestamp = int(time.time())
            version_data = {
                "version": f"v{timestamp}",
                "chapter_ref": chapter_ref,
                "created_at": timestamp,
                "comment": "自动保存",
                "snapshot": {
                    "prose": new_prose,
                    "outline": data.get("outline", {}),
                    "status": data.get("status", ""),
                },
            }
            await get_storage().write_yaml(
                root_path, f"versions/{chapter_ref}/v{timestamp}.yaml", version_data
            )
```

### Task 2: Create versions router

Create `backend/chapters/versions.py`:

```python
"""Chapter version management: list, restore, and diff."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from projects.service import get_project
from workflow.engine import _validate_ref, save_chapter

router = APIRouter(prefix="/api/projects/{project_id}/chapters/{chapter_ref}", tags=["versions"])


@router.get("/versions")
async def list_versions(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    
    files = await get_storage().list_dir(project.root_path, f"versions/{chapter_ref}")
    versions = []
    for f in sorted(files, reverse=True):
        if not f.endswith(".yaml"):
            continue
        data = await get_storage().read_yaml(project.root_path, f"versions/{chapter_ref}/{f}")
        if data:
            versions.append({
                "version": data.get("version", f.replace(".yaml", "")),
                "time": data.get("created_at", 0),
                "comment": data.get("comment", ""),
                "isCurrent": False,
            })
    
    # Mark the latest as current (or add current chapter's version info)
    chapter = await get_storage().read_yaml(project.root_path, f"chapters/{chapter_ref}.yaml")
    if versions:
        versions[0]["isCurrent"] = True
    
    return versions


@router.post("/versions/{version_id}/restore")
async def restore_version(
    project_id: str,
    chapter_ref: str,
    version_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
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
    
    # Restore the chapter from snapshot
    chapter = await get_storage().read_yaml(project.root_path, f"chapters/{chapter_ref}.yaml") or {}
    chapter["prose"] = snapshot.get("prose", chapter.get("prose", ""))
    if "outline" in snapshot:
        chapter["outline"] = snapshot["outline"]
    if "status" in snapshot:
        chapter["status"] = snapshot["status"]
    
    await save_chapter(project.root_path, chapter_ref, chapter)
    return {"ok": True, "restored": version_id}
```

### Task 3: Register the router

In `backend/main.py`, add:
```python
from chapters.versions import router as chapters_versions_router
# ... 
app.include_router(chapters_versions_router)
```

### Task 4: Update VersionHistory frontend

Replace mock data with real API calls in `frontend/src/components/novel/VersionHistory.tsx`.
