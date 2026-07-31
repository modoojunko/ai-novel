# backend/auth_local/middleware.py
"""C/S 模式下从本地 config.json 读取登录状态"""

import os

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer(auto_error=False)

CONFIG_FILE = os.environ.get("DATA_ROOT", "./data") + "/config.json"


def get_local_config() -> dict:
    try:
        import json

        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
    except OSError:
        pass
    return {}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """验证本地 OAuth 会话，返回用户标识。

    C端 不自行验签 JWT —— token 由 S端 OAuth 授权流程签发并存入 config.json，
    这里只核对请求头携带的 token 与本地 OAuth 会话 token 是否一致，身份取
    S端 授权时下发的 username。校验失败视为未登录。
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="未提供认证信息")

    cfg = get_local_config()
    stored_token = cfg.get("token", "")
    if not stored_token or credentials.credentials != stored_token:
        raise HTTPException(status_code=401, detail="登录状态无效，请重新登录")

    # 会话新鲜度（S端 OAuth 下发时写入）：过期/超期则强制重新登录
    from datetime import UTC, date, datetime, timedelta

    last_login = cfg.get("last_login_at", "")
    if last_login:
        try:
            login_time = datetime.fromisoformat(last_login)
            if datetime.now(UTC) - login_time > timedelta(days=30):
                raise HTTPException(status_code=401, detail="登录已超过 30 天，请重新登录")
        except ValueError:
            pass
    expires_at = cfg.get("expires_at", "")
    if expires_at:
        try:
            expiry = date.fromisoformat(expires_at[:10])
            if date.today() > expiry:
                raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
        except ValueError:
            pass

    username = cfg.get("username", "")
    if not username:
        raise HTTPException(status_code=401, detail="未获取到登录用户")

    # 确保本地存在该用户（OAuth 授权时已创建；此处兜底）
    try:
        from sqlalchemy import select as _select

        from db import async_session as _session
        from models.user import User as _User

        async with _session() as s:
            r = await s.execute(_select(_User).where(_User.id == username))
            if not r.scalar_one_or_none():
                s.add(
                    _User(
                        id=username,
                        email=f"{username}@s.local",
                        password_hash="*",
                        display_name=username,
                    )
                )
                await s.commit()
    except Exception:  # noqa: S110
        pass

    return {"id": username}
