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
    """验证本地 token，返回用户标识"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="未提供认证信息")

    token = credentials.credentials

    # 尝试验证 JWT（S端 部署环境使用的格式）
    from jose import jwt as jose_jwt

    from config import JWT_ALGORITHM, JWT_SECRET

    try:
        payload = jose_jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"id": payload.get("sub", "")}
    except jose_jwt.JWTError:
        pass

    raise HTTPException(status_code=401, detail="无效的令牌")
