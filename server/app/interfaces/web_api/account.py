"""门户账户 API：web/login, web/register, user/me, user/password, user/security。"""
from __future__ import annotations
import logging
from fastapi import Depends

from app.interfaces.deps import get_db, get_current_user_or_none, Db
from app.interfaces.dto import (
    WebLoginRequest, WebRegisterRequest,
    ChangePasswordRequest, SecurityRequest, ok, fail,
)
from app.application.identity.login import login
from app.application.identity.register_user import register_user
from app.infrastructure.repositories.factory import user_repo, code_repo
from app.infrastructure.security.password import verify_password, hash_password

logger = logging.getLogger("api.web.account")

from app.interfaces.web_api.router import router as r


@r.post("/api/web/login")
async def api_web_login(req: WebLoginRequest, db: Db = Depends(get_db)):
    """登录返回 JWT token。"""
    return login(user_repo(db), code_repo(db), req.username.strip(), req.password)


@r.post("/api/web/register")
async def api_web_register(req: WebRegisterRequest, db: Db = Depends(get_db)):
    result = register_user(
        user_repo(db), code_repo(db),
        req.username.strip(), req.password,
        req.security_question, req.security_answer,
    )
    if result["code"] == 0:
        db.commit()
    return result


@r.get("/api/user/me")
async def api_user_me(db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    if not username:
        return fail(code=1, msg="未登录")
    from app.application.licensing.get_license_info import get_license_info
    return get_license_info(user_repo(db), code_repo(db), username)


@r.put("/api/user/password")
async def api_user_password(req: ChangePasswordRequest, db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    if not username:
        return fail(code=1, msg="未登录")
    user = user_repo(db).get(username)
    if not user or not verify_password(req.old_password, user.password_hash):
        return fail(code=1, msg="旧密码错误")
    if len(req.new_password) < 6:
        return fail(code=1, msg="密码至少6位")
    user_repo(db).update_password(username, hash_password(req.new_password))
    db.commit()
    return ok({"success": True})


@r.put("/api/user/security")
async def api_user_security(req: SecurityRequest, db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    if not username:
        return fail(code=1, msg="未登录")
    user_repo(db).update_security(username, req.security_question, hash_password(req.security_answer))
    db.commit()
    return ok({"success": True})
