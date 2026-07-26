"""POST /api/login - 用户名密码登录 + 设备绑定"""

from datetime import date, datetime
from lib.db import get_collection
from lib.auth_utils import hash_password, verify_password, create_jwt, verify_jwt

MAX_DEVICES = 3


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    password = body.get("password", "")
    pc_hash = body.get("pc_hash", "").strip()
    pc_name = body.get("pc_name", "").strip()

    if not all([username, password, pc_hash]):
        return {"code": 1, "msg": "缺少必要参数"}

    # 验证用户
    users_coll = get_collection("users")
    records = users_coll.where({"username": username}).get()
    if not records or len(records) == 0:
        return {"code": 1, "msg": "用户名或密码错误"}

    user = records[0]
    if not verify_password(password, user.get("password_hash", "")):
        return {"code": 1, "msg": "用户名或密码错误"}
    if user.get("status") != "active":
        return {"code": 1, "msg": "账户已被锁定，请联系客服"}

    # 查名下所有激活码，计算合并到期日
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

    if max_expires is None or max_expires < date.today():
        return {"code": 1, "msg": "License 已过期，请续期"}

    # 检查/绑定设备
    devices_coll = get_collection("devices")
    all_devices = devices_coll.where({"username": username}).get() or []

    existing_device = None
    for d in all_devices:
        if d.get("pc_hash") == pc_hash:
            existing_device = d
            break

    if existing_device:
        # 更新最后活跃时间
        devices_coll.doc(existing_device["_id"]).update({
            "last_active_at": datetime.now().isoformat()
        })
    else:
        # 新设备：检查数量上限
        if len(all_devices) >= MAX_DEVICES:
            return {"code": 2, "msg": f"已超过最大设备数（{MAX_DEVICES} 台），请先在旧设备上解绑"}
        devices_coll.add({
            "username": username,
            "pc_hash": pc_hash,
            "pc_name": pc_name,
            "last_active_at": datetime.now().isoformat(),
            "bound_at": datetime.now().isoformat(),
        })

    # 刷新设备列表
    all_devices = devices_coll.where({"username": username}).get() or []
    device_list = [{
        "pc_hash": d.get("pc_hash"),
        "pc_name": d.get("pc_name"),
        "last_active_at": d.get("last_active_at"),
        "bound_at": d.get("bound_at"),
    } for d in all_devices]

    token = create_jwt(username)
    return {
        "code": 0,
        "data": {
            "token": token,
            "expires_at": max_expires.isoformat() if max_expires else None,
            "tier": ", ".join(sorted(tiers)) if tiers else "",
            "devices": device_list,
        }
    }
