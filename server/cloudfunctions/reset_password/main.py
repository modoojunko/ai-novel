"""POST /api/reset_password - 密保重置密码"""

from lib.db import get_collection
from lib.auth_utils import hash_password, verify_password


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    security_answer = body.get("security_answer", "").strip()
    new_password = body.get("new_password", "")

    if not all([username, security_answer, new_password]):
        return {"code": 1, "msg": "缺少必要参数"}
    if len(new_password) < 6:
        return {"code": 1, "msg": "密码至少 6 位"}

    users_coll = get_collection("users")
    records = users_coll.where({"username": username}).get()
    if not records or len(records) == 0:
        return {"code": 1, "msg": "用户不存在"}

    user = records[0]
    if not verify_password(security_answer, user.get("security_answer_hash", "")):
        return {"code": 1, "msg": "密保答案错误"}

    users_coll.doc(user["_id"]).update({
        "password_hash": hash_password(new_password)
    })

    return {"code": 0, "data": {"success": True}}
