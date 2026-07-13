"""POST /api/verify - 启动验证 + 每日心跳"""

from datetime import date, datetime
from lib.db import get_collection
from lib.auth_utils import verify_jwt


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    token = body.get("token", "")
    pc_hash = body.get("pc_hash", "").strip()

    if not all([username, token, pc_hash]):
        return {"code": 1, "msg": "缺少必要参数"}

    # 验证 JWT
    payload = verify_jwt(token)
    if not payload:
        return {"code": 2, "msg": "Token 无效或已过期，请重新登录"}
    if payload.get("sub") != username:
        return {"code": 2, "msg": "Token 和用户名不匹配"}

    # 查激活码
    codes_coll = get_collection("codes")
    user_codes = codes_coll.where({"bound_username": username, "status": "active"}).get()

    max_expires = None
    tiers = set()
    for c in user_codes or []:
        exp = c.get("expires_at")
        if exp:
            exp_date = date.fromisoformat(exp) if isinstance(exp, str) else exp
            if max_expires is None or exp_date > max_expires:
                max_expires = exp_date
        tiers.add(c.get("tier", ""))

    valid = max_expires is not None and max_expires >= date.today()

    # 验证设备
    devices_coll = get_collection("devices")
    all_devices = devices_coll.where({"username": username}).get() or []

    device_valid = False
    device_list = []
    for d in all_devices:
        info = {
            "pc_hash": d.get("pc_hash"),
            "pc_name": d.get("pc_name"),
            "last_active_at": d.get("last_active_at"),
            "bound_at": d.get("bound_at"),
        }
        device_list.append(info)
        if d.get("pc_hash") == pc_hash:
            device_valid = True
            # 更新活跃时间
            devices_coll.doc(d["_id"]).update({
                "last_active_at": datetime.now().isoformat()
            })

    return {
        "code": 0,
        "data": {
            "valid": valid and device_valid,
            "license_valid": valid,
            "device_valid": device_valid,
            "expires_at": max_expires.isoformat() if max_expires else None,
            "tier": ", ".join(sorted(tiers)) if tiers else "",
            "devices": device_list,
            "max_devices": 3,
        }
    }
