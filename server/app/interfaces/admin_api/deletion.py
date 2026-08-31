"""运营管理 API：deletion_scan（注销到期补偿扫描，design D2 兜底）。

触发方式（二选一，tasks 3.5）：
- CloudBase 定时触发器周期 POST 本端点（CloudRun 环境变量 ADMIN_TOKEN 鉴权）；
- 人工/运维手动触发。
惰性触发（登录/check-auth 链路）为主路径，本端点只兜"无人登录的账号也按期注销"。
"""
from __future__ import annotations

import logging

from fastapi import Depends

from app.application.identity.deletion_service import execute_due_deletions
from app.config import settings
from app.infrastructure.repositories.factory import (
    code_repo,
    device_repo,
    grant_repo,
    user_repo,
)
from app.interfaces.admin_api.router import router as r
from app.interfaces.deps import Db, get_db
from app.interfaces.dto import AdminScanRequest

logger = logging.getLogger("api.admin.deletion")


@r.post("/api/admin/deletion-scan")
async def api_admin_deletion_scan(req: AdminScanRequest, db: Db = Depends(get_db)):
    """扫描到期未撤销的注销申请并执行（幂等，可安全重入/与惰性触发并发）。"""
    if req.admin_token != settings.ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}
    result = execute_due_deletions(
        user_repo(db), code_repo(db), device_repo(db), grant_repo(db),
    )
    logger.info("event=deletion.scan processed=%s", result["data"]["count"])
    return result
