"""C端 License/设备验证端点 /api/verify。"""
from __future__ import annotations
import logging
from fastapi import Depends

from app.interfaces.deps import get_db, Db
from app.interfaces.dto import VerifyRequest
from app.application.devices.verify_license import verify_license
from app.infrastructure.repositories.factory import user_repo, code_repo, device_repo, grant_repo

logger = logging.getLogger("api.client.verify")

from app.interfaces.client_api.router import router as r


@r.post("/api/verify")
async def api_verify(
    req: VerifyRequest,
    db: Db = Depends(get_db),
):
    """验证 License + 设备绑定状态（C端 心跳用）。"""
    logger.info("event=verify.start user=%s", req.username)
    result = verify_license(
        user_repo(db), code_repo(db), device_repo(db), grant_repo(db),
        username=req.username,
        pc_hash=req.pc_hash,
        token=req.token,
    )
    logger.info("event=verify.result user=%s code=%d", req.username, result["code"])
    return result
