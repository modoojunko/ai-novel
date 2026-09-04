"""备份导出/恢复导入路由（c-novel-export-roundtrip）。

PR0 仅含旧库留档检测（legacy-db/status）；导出与包导入端点随 PR1/PR2 落地。
"""

from pathlib import Path

from fastapi import APIRouter, Depends

from auth_local.middleware import get_current_user
from config import DATA_ROOT
from legacy_archive import inspect_library

# 持有自己的 APIRouter，由 main.py 显式 include（与 account/devices 同款）。
router = APIRouter(prefix="/api/backup", tags=["backup"])


def _scan_legacy_archives(data_root: Path) -> list[dict]:
    """枚举 novel.legacy-*.db 留档，最新在前；逐个只读体检。"""
    items = []
    for f in sorted(data_root.glob("novel.legacy-*.db"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = f.stat()
        info = inspect_library(f)
        items.append({
            "filename": f.name,
            "size_bytes": stat.st_size,
            "archived_at": int(stat.st_mtime),
            "book_count": info.get("book_count"),
            "unreadable": info.get("unreadable", False),
        })
    return items


@router.get("/legacy-db/status")
async def legacy_db_status(user: dict = Depends(get_current_user)):
    """首启检测/设置徽标数据源（quiet：前端对 401/失败自行降级，不弹提示）。"""
    root = Path(DATA_ROOT)
    archives = _scan_legacy_archives(root)
    latest = archives[0] if archives else None
    return {"code": 0, "data": {
        "present": bool(archives),
        "filename": latest["filename"] if latest else None,
        "book_count": latest["book_count"] if latest else None,
        "size_bytes": latest["size_bytes"] if latest else None,
        "archived_at": latest["archived_at"] if latest else None,
        "all": archives,
    }}
