"""POST /api/renew - 续期叠加"""

from datetime import date
from lib.db import get_collection
from lib.auth_utils import verify_jwt


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    token = body.get("token", "")
    activation_code = body.get("activation_code", "").strip().upper()

    if not all([username, token, activation_code]):
        return {"code": 1, "msg": "缺少必要参数"}

    payload = verify_jwt(token)
    if not payload or payload.get("sub") != username:
        return {"code": 2, "msg": "Token 无效"}

    codes_coll = get_collection("codes")
    records = codes_coll.where({"code_id": activation_code}).get()
    if not records or len(records) == 0:
        return {"code": 1, "msg": "无效的激活码"}

    code = records[0]
    if code.get("status") != "unused":
        return {"code": 1, "msg": "激活码已被使用"}

    # 计算当前到期日
    user_codes = codes_coll.where({"bound_username": username, "status": "active"}).get()
    current_expiry = None
    for c in user_codes or []:
        exp = c.get("expires_at")
        if exp:
            exp_date = date.fromisoformat(exp) if isinstance(exp, str) else exp
            if current_expiry is None or exp_date > current_expiry:
                current_expiry = exp_date

    # 新到期日 = max(当前到期日, 今天) + duration_days
    base = max(current_expiry, date.today()) if current_expiry else date.today()
    duration_map = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
    days = duration_map.get(code.get("tier", "monthly"), 30)
    new_expires = base + __import__("datetime").timedelta(days=days)

    codes_coll.doc(code["_id"]).update({
        "status": "active",
        "bound_username": username,
        "activated_at": date.today().isoformat(),
        "expires_at": new_expires.isoformat(),
    })

    return {
        "code": 0,
        "data": {
            "new_expires_at": new_expires.isoformat(),
        }
    }
