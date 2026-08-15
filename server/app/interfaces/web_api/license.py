"""门户 License API：license/activate。"""
from __future__ import annotations
from fastapi import Depends

from app.interfaces.deps import get_db, get_current_user_or_none, Db
from app.interfaces.dto import ActivateLicenseRequest, ok, fail
from app.application.licensing.activate_code import activate_code
from app.infrastructure.repositories.factory import code_repo

from app.interfaces.web_api.router import router as r


@r.post("/api/license/activate")
async def api_license_activate(req: ActivateLicenseRequest, db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    if not username:
        return fail(code=1, msg="未登录")
    result = activate_code(code_repo(db), username, req.code.strip().upper())
    if result["code"] == 0:
        db.commit()
    return result
