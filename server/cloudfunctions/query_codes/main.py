"""POST /api/query_codes - 查询激活码（管理用）"""

import os
from lib.db import get_collection

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "change-me")


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    admin_token = body.get("admin_token", "")
    username = body.get("username", "")

    if admin_token != ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}

    codes_coll = get_collection("codes")
    if username:
        records = codes_coll.where({"bound_username": username}).order_by("created_at", "desc").get()
    else:
        records = codes_coll.order_by("created_at", "desc").limit(200).get()

    code_list = [{
        "code_id": c.get("code_id"),
        "tier": c.get("tier"),
        "status": c.get("status"),
        "bound_username": c.get("bound_username"),
        "expires_at": c.get("expires_at"),
        "created_at": c.get("created_at"),
    } for c in (records or [])]

    return {"code": 0, "data": {"codes": code_list}}
