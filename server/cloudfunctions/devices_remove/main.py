"""POST /api/devices/remove - 解绑设备"""

from lib.db import get_collection
from lib.auth_utils import verify_jwt


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    token = body.get("token", "")
    pc_hash = body.get("pc_hash", "").strip()

    if not all([username, token, pc_hash]):
        return {"code": 1, "msg": "缺少必要参数"}

    payload = verify_jwt(token)
    if not payload or payload.get("sub") != username:
        return {"code": 2, "msg": "Token 无效"}

    devices_coll = get_collection("devices")
    records = devices_coll.where({"username": username, "pc_hash": pc_hash}).get()
    if records and len(records) > 0:
        devices_coll.doc(records[0]["_id"]).remove()

    return {"code": 0, "data": {"success": True}}
