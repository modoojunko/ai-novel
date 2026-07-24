# backend/auth_local/middleware.py
"""C/S 模式下从本地 config.json 读取登录状态"""

import os
from typing import Dict
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

CONFIG_FILE = os.environ.get("DATA_ROOT", "./data") + "/config.json"


def get_local_config() -> dict:
    try:
        import json

        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict:
    """验证本地 token，返回用户标识"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="未提供认证信息")

    token = credentials.credentials

    if os.environ.get("DEV_MODE"):
        # 开发模式：接受 "dev-token"（旧式）或有效 JWT
        if token == "dev-token":
            return {"id": "devuser"}
        # 尝试验证 JWT
        from jose import jwt as jose_jwt
        from config import JWT_SECRET, JWT_ALGORITHM

        try:
            payload = jose_jwt.decode(
                token, JWT_SECRET, algorithms=[JWT_ALGORITHM]
            )
            return {"id": payload.get("sub", "devuser")}
        except Exception:
            raise HTTPException(status_code=401, detail="无效的令牌")

    cfg = get_local_config()
    local_token = cfg.get("token", "")
    if not local_token:
        raise HTTPException(status_code=401, detail="未登录")
    return {"id": local_token[:8]}
