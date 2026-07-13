"""POST /api/activate - 激活码验证 + 首次注册"""

from datetime import date
from lib.db import get_collection
from lib.auth_utils import hash_password, verify_password, create_jwt
from lib.code_utils import calc_expires_at


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    activation_code = body.get("activation_code", "").strip().upper()
    username = body.get("username", "").strip()
    password = body.get("password", "")
    security_question = body.get("security_question", "").strip()
    security_answer = body.get("security_answer", "").strip()
    pc_hash = body.get("pc_hash", "").strip()
    pc_name = body.get("pc_name", "").strip()

    # 参数校验
    if not all([activation_code, username, password, security_question, security_answer, pc_hash]):
        return {"code": 1, "msg": "缺少必要参数"}
    if len(username) < 2 or len(username) > 20:
        return {"code": 1, "msg": "用户名长度 2-20 个字符"}
    if len(password) < 6:
        return {"code": 1, "msg": "密码至少 6 位"}

    # 检查用户名是否已存在
    users_coll = get_collection("users")
    existing = users_coll.where({"username": username}).get()
    if existing and len(existing) > 0:
        return {"code": 1, "msg": "用户名已存在"}

    # 验证激活码
    codes_coll = get_collection("codes")
    code_records = codes_coll.where({"code_id": activation_code}).get()
    if not code_records or len(code_records) == 0:
        return {"code": 1, "msg": "无效的激活码"}

    code = code_records[0]
    if code.get("status") != "unused":
        return {"code": 1, "msg": "激活码已被使用或已过期"}

    # 创建用户
    user_data = {
        "username": username,
        "password_hash": hash_password(password),
        "security_question": security_question,
        "security_answer_hash": hash_password(security_answer),
        "status": "active",
        "created_at": __import__("datetime").datetime.now().isoformat(),
    }
    users_coll.add(user_data)

    # 更新激活码状态
    expires_at = calc_expires_at(code.get("tier", "monthly"))
    codes_coll.doc(code["_id"]).update({
        "status": "active",
        "bound_username": username,
        "activated_at": date.today().isoformat(),
        "expires_at": expires_at.isoformat(),
    })

    # 绑定设备
    devices_coll = get_collection("devices")
    devices_coll.add({
        "username": username,
        "pc_hash": pc_hash,
        "pc_name": pc_name,
        "last_active_at": __import__("datetime").datetime.now().isoformat(),
        "bound_at": __import__("datetime").datetime.now().isoformat(),
        "activation_code": activation_code,
    })

    token = create_jwt(username)
    # 查已绑定设备列表
    devices = list_devices(username)

    return {
        "code": 0,
        "data": {
            "token": token,
            "tier": code.get("tier"),
            "expires_at": expires_at.isoformat(),
            "devices": devices,
        }
    }


def list_devices(username: str) -> list:
    """查询用户所有设备"""
    devices_coll = get_collection("devices")
    records = devices_coll.where({"username": username}).get()
    result = []
    for d in records or []:
        result.append({
            "pc_hash": d.get("pc_hash"),
            "pc_name": d.get("pc_name"),
            "last_active_at": d.get("last_active_at"),
            "bound_at": d.get("bound_at"),
        })
    return result
