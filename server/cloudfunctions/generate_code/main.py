"""POST /api/generate_code - 批量生成激活码（管理用）"""

import os
from lib.db import get_collection
from lib.code_utils import generate_activation_code

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "change-me")


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    admin_token = body.get("admin_token", "")
    tier = body.get("tier", "monthly")
    count = int(body.get("count", 1))

    if admin_token != ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}

    if tier not in ("monthly", "quarterly", "yearly", "lifetime"):
        return {"code": 1, "msg": "无效的套餐类型"}
    if count < 1 or count > 100:
        return {"code": 1, "msg": "生成数量 1-100"}

    duration_map = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
    codes_coll = get_collection("codes")
    now = __import__("datetime").datetime.now().isoformat()
    generated = []

    for _ in range(count):
        code_id = generate_activation_code()
        codes_coll.add({
            "code_id": code_id,
            "tier": tier,
            "duration_days": duration_map[tier],
            "status": "unused",
            "created_at": now,
        })
        generated.append(code_id)

    return {"code": 0, "data": {"codes": generated, "count": len(generated)}}
