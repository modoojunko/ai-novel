"""C端 账户端点：reset_password。"""
from __future__ import annotations
from fastapi import Depends
from sqlalchemy.orm import Session

from app.interfaces.deps import get_db
from app.interfaces.dto import ResetPasswordRequest
from app.application.identity.reset_password import reset_password
from app.infrastructure.repositories.user_repo import UserRepo

from app.interfaces.client_api.router import router as r


@r.post("/api/reset_password")
async def api_reset_password(
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    result = reset_password(UserRepo(db), req.username.strip(), req.security_answer, req.new_password)
    if result["code"] == 0:
        db.commit()
    return result
