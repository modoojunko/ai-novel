"""门户设备 API：device/my, device/remove。"""
from __future__ import annotations
from fastapi import Depends

from app.interfaces.deps import get_db, get_current_user_or_none, Db
from app.interfaces.dto import DeviceRemoveRequest, ok, fail
from app.application.devices.list_devices import list_devices
from app.application.devices.remove_device import remove_device
from app.infrastructure.repositories.factory import device_repo, code_repo

from app.interfaces.web_api.router import router as r


@r.get("/api/device/my")
async def api_device_my(db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    if not username:
        return fail(code=1, msg="未登录")
    return list_devices(device_repo(db), code_repo(db), username)


@r.post("/api/device/remove")
async def api_device_remove(req: DeviceRemoveRequest, db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    if not username:
        return fail(code=1, msg="未登录")
    result = remove_device(device_repo(db), username, req.id)
    db.commit()
    return result
