"""POST /api/devices/list - 查看已绑定设备"""

from lib.db import get_collection
from lib.auth_utils import verify_jwt


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    token = body.get("token", "")

    payload = verify_jwt(token)
    if not payload or payload.get("sub") != username:
        return {"code": 2, "msg": "Token 无效"}

    devices_coll = get_collection("devices")
    records = devices_coll.where({"username": username}).get() or []
    device_list = [{
        "pc_hash": d.get("pc_hash"),
        "pc_name": d.get("pc_name"),
        "last_active_at": d.get("last_active_at"),
        "bound_at": d.get("bound_at"),
    } for d in records]

    return {"code": 0, "data": {"devices": device_list, "max_devices": 3}}
