"""门户账户 API：web/login, web/register, user/me, user/password, user/security, user/deletion*。"""
from __future__ import annotations

import logging

from fastapi import Depends
from fastapi.responses import JSONResponse

from app.application.identity.deletion_service import (
    deletion_status as deletion_status_uc,
    request_deletion,
    revoke_deletion,
)
from app.application.identity.login import login
from app.application.identity.register_user import register_user
from app.application.identity.update_user_theme import (
    InvalidThemeError,
    update_user_theme,
)
from app.infrastructure.repositories.factory import (
    code_repo,
    device_repo,
    grant_repo,
    user_repo,
)
from app.infrastructure.security.password import hash_password, verify_password
from app.interfaces.deps import Db, get_current_user_or_none, get_db
from app.interfaces.dto import (
    ChangePasswordRequest,
    DeletionRevokeRequest,
    DeletionRequest,
    PreferencesRequest,
    SecurityRequest,
    WebLoginRequest,
    WebRegisterRequest,
    fail,
    ok,
)

logger = logging.getLogger("api.web.account")

from app.interfaces.web_api.router import router as r


@r.post("/api/web/login")
async def api_web_login(req: WebLoginRequest, db: Db = Depends(get_db)):
    """登录返回 JWT token。撤销期/已注销账号返回结构化状态（account-deletion）。"""
    return login(user_repo(db), code_repo(db), req.username.strip(), req.password,
                 device_repo=device_repo(db), grant_repo=grant_repo(db))


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


@r.put("/api/user/preferences")
async def api_user_preferences(req: PreferencesRequest, db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    """主题偏好写入（theme-preferences）。非法 key 422，不落库。"""
    if not username:
        return fail(code=1, msg="未登录")
    try:
        theme = update_user_theme(user_repo(db), username, req.theme)
    except InvalidThemeError:
        return JSONResponse(status_code=422, content=fail(code=422, msg=f"不支持的主题：{req.theme}"))
    db.commit()
    return ok({"theme": theme if theme else "teal"})


# ── 账号自助注销（account-deletion）：S 端向导三端点 ──

@r.get("/api/user/deletion-status")
async def api_user_deletion_status(db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    """注销状态查询（R7）：是否已申请 / 剩余撤销天数 / 到期执行时刻。"""
    if not username:
        return fail(code=1, msg="未登录")
    user = user_repo(db).get(username)
    if not user:
        return fail(code=1, msg="用户不存在")
    return deletion_status_uc(user)


@r.post("/api/user/deletion")
async def api_user_deletion(req: DeletionRequest, db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    """受理注销申请（R2/R3/R4）：密码确认 + 未消耗权益校验 + CAS 进入 15 天撤销期。"""
    if not username:
        return fail(code=1, msg="未登录")
    return request_deletion(user_repo(db), code_repo(db), username, req.password, req.waive_assets)


@r.post("/api/user/deletion/revoke")
async def api_user_deletion_revoke(req: DeletionRevokeRequest, db: Db = Depends(get_db), username: str = Depends(get_current_user_or_none)):
    """撤销注销（R4）：密码同强度验证 + CAS，撤销成功账号立即恢复。"""
    if not username:
        return fail(code=1, msg="未登录")
    return revoke_deletion(user_repo(db), username, req.password)
