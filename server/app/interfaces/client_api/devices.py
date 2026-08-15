"""C端 设备端点：devices/current, consume-enrolled。"""
from __future__ import annotations
import logging
from fastapi import Depends, Header
from fastapi.responses import JSONResponse

from app.interfaces.deps import get_db, get_current_user_or_none, Db
from app.application.devices.get_device_status import get_device_status
from app.application.devices.consume_enrolled import consume_enrolled
from app.infrastructure.repositories.factory import grant_repo, device_repo, code_repo

logger = logging.getLogger("api.client.devices")

from app.interfaces.client_api.router import router as r


@r.get("/api/devices/current")
async def api_devices_current(
    pc_hash: str = "",
    authorization: str = Header(default=""),
    db: Db = Depends(get_db),
):
    """获取当前设备状态（裸字段格式，冻结）。"""
    user_id = get_current_user_or_none(authorization=authorization)
    if not user_id:
        return JSONResponse({"code": -1, "msg": "无效的令牌"}, status_code=401)

    logger.info("event=devices_current.start user=%s pc_hash=%s", user_id, pc_hash)
    result = get_device_status(
        grant_repo(db), device_repo(db), code_repo(db),
        username=user_id, pc_hash=pc_hash,
    )
    return result


@r.post("/api/devices/consume-enrolled")
async def api_consume_enrolled(
    pc_hash: str = "",
    authorization: str = Header(default=""),
    db: Db = Depends(get_db),
):
    """消费 enrolled 标记。"""
    user_id = get_current_user_or_none(authorization=authorization)
    if not user_id:
        return {"code": -1, "msg": "无效的令牌"}

    result = consume_enrolled(grant_repo(db), pc_hash, user_id)
    db.commit()
    return result
