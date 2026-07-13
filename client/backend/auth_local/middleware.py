# backend/auth_local/middleware.py
"""临时兼容层 — C/S 模式下返回本地用户

TODO(C/S): 在 Task 6 完成后，所有路由应迁移到 auth_local 的验证方式。
当前只做最小改动：将 get_current_user 改为从本地配置读取用户名。
"""

import json
import os
from typing import Dict
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)


def get_local_username() -> str:
    """从本地 config.json 读取当前登录的用户名"""
    config_file = os.environ.get("DATA_ROOT", "./data") + "/config.json"
    try:
        if os.path.exists(config_file):
            with open(config_file, "r") as f:
                cfg = json.load(f)
                return cfg.get("username", "")
    except Exception:
        pass
    return ""


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """兼容原 auth.middleware.get_current_user 接口

    返回格式: {"id": username}
    C/S 模式下不检查 JWT，直接从本地配置读取用户名。
    """
    # DEV_MODE: 自动返回 dev 用户
    if os.environ.get("DEV_MODE"):
        return {"id": "devuser"}
    username = get_local_username()
    if not username:
        raise HTTPException(status_code=401, detail="未登录")
    return {"id": username}
