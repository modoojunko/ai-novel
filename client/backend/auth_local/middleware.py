# backend/auth_local/middleware.py
"""C/S 模式下从本地 config.json 读取用户信息"""

import json
import os
from typing import Dict
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

CONFIG_FILE = os.environ.get("DATA_ROOT", "./data") + "/config.json"


def get_local_config() -> dict:
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """从本地 config.json 读取当前用户"""
    if os.environ.get("DEV_MODE"):
        return {"id": "devuser"}
    cfg = get_local_config()
    username = cfg.get("username", "")
    token = cfg.get("token", "")
    if not username or not token:
        raise HTTPException(status_code=401, detail="未登录")
    return {"id": username}
