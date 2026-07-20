# backend/auth_local/service.py
"""浏览器 OAuth 登录 + 30 天滚动验证"""

import json
import os
import platform
import hashlib
import subprocess
import webbrowser
import time
import asyncio
from datetime import datetime, timedelta, date

import httpx

from config import SERVER_API_BASE

CONFIG_DIR = os.environ.get("DATA_ROOT", "./data")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
SESSION_DAYS = 30
POLL_INTERVAL = 2
POLL_TIMEOUT = 120


def get_local_config() -> dict:
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def save_local_config(config: dict):
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def load_or_create_config() -> dict:
    cfg = get_local_config()
    changed = False
    defaults = {
        "pc_hash": "",
        "pc_name": "",
        "api_key": "",
        "api_base_url": "https://api.deepseek.com/anthropic",
        "api_model": "deepseek-v4-flash",
        "token": "",
        "tier": "none",
        "expires_at": "",
        "last_login_at": "",
    }
    for k, v in defaults.items():
        if k not in cfg:
            cfg[k] = v
            changed = True
    if not cfg.get("pc_hash"):
        cfg["pc_hash"] = generate_pc_hash()
        cfg["pc_name"] = platform.node() or "My PC"
        changed = True
    if os.environ.get("DEV_MODE") and not cfg.get("token"):
        cfg["token"] = "dev-token"
        cfg["tier"] = "lifetime"
        cfg["last_login_at"] = datetime.now().isoformat()
        changed = True
    if changed:
        save_local_config(cfg)
    return cfg


def generate_pc_hash() -> str:
    info = []
    try:
        for wmic_query in [
            "cpu get ProcessorId",
            "baseboard get SerialNumber",
            "diskdrive get SerialNumber",
        ]:
            try:
                result = subprocess.run(
                    ["wmic"] + wmic_query.split(),
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if result.returncode == 0:
                    lines = result.stdout.strip().split("\n")
                    if len(lines) > 1:
                        val = lines[1].strip()
                        if val:
                            info.append(val)
            except Exception:
                continue
    except Exception:
        pass
    if not info:
        try:
            info.append(platform.node() or "")
            result = subprocess.run(
                ["wmic", "os", "get", "SerialNumber"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")
                if len(lines) > 1:
                    info.append(lines[1].strip())
        except Exception:
            pass
    raw = "-".join(info) or platform.node() or "unknown"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


async def call_server_api(
    endpoint: str, method: str = "GET", params: dict = None, json_body: dict = None
) -> dict:
    url = f"{SERVER_API_BASE}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if method == "GET":
                resp = await client.get(url, params=params)
            else:
                resp = await client.post(url, json=json_body)
            return resp.json()
    except httpx.TimeoutException:
        return {"code": -1, "msg": "网络超时"}
    except Exception as e:
        return {"code": -1, "msg": f"网络错误: {str(e)}"}


async def browser_auth() -> dict:
    """打开系统浏览器让用户在 S端 登录，后台轮询授权结果"""
    cfg = load_or_create_config()
    pc_hash = cfg["pc_hash"]

    if os.environ.get("DEV_MODE"):
        cfg["token"] = "dev-token"
        cfg["tier"] = "lifetime"
        cfg["last_login_at"] = datetime.now().isoformat()
        save_local_config(cfg)
        return {"code": 0, "data": {"message": "开发模式"}}

    # 打开浏览器到 S端 授权页面
    auth_url = f"{SERVER_API_BASE}/auth-page?pc_hash={pc_hash}"
    webbrowser.open(auth_url)

    # 轮询等待用户授权
    start = time.time()
    while time.time() - start < POLL_TIMEOUT:
        result = await call_server_api("check-auth", params={"pc_hash": pc_hash})
        if result.get("code") == 0:
            data = result["data"]
            cfg["token"] = data["token"]
            cfg["tier"] = data.get("tier", "none")
            cfg["expires_at"] = data.get("expires_at", "")
            cfg["last_login_at"] = datetime.now().isoformat()
            save_local_config(cfg)
            return {"code": 0, "data": {"message": "授权成功", "tier": cfg["tier"], "token": cfg["token"]}}
        await asyncio.sleep(POLL_INTERVAL)

    return {"code": -1, "msg": "授权超时，请在浏览器中完成登录"}


async def verify_session() -> dict:
    """验证 30 天会话"""
    cfg = load_or_create_config()
    token = cfg.get("token", "")
    last_login = cfg.get("last_login_at", "")

    if os.environ.get("DEV_MODE"):
        return {"valid": True, "tier": cfg.get("tier", "lifetime")}

    if not token:
        return {"valid": False, "msg": "未登录"}

    try:
        login_time = datetime.fromisoformat(last_login) if last_login else None
        if login_time and datetime.now() - login_time > timedelta(days=SESSION_DAYS):
            return {"valid": False, "msg": f"登录已超过 {SESSION_DAYS} 天，请重新登录"}
    except ValueError:
        return {"valid": False, "msg": "登录信息异常"}

    if login_time and datetime.now() < login_time:
        return {"valid": False, "msg": "系统时间异常"}

    return {"valid": True, "tier": cfg.get("tier", "none")}


def check_permission() -> dict:
    """检查当前用户套餐权限"""
    cfg = get_local_config()
    tier = cfg.get("tier", "none")
    expires_at = cfg.get("expires_at", "")

    if os.environ.get("DEV_MODE"):
        return {"allowed": True, "tier": "lifetime"}

    if tier == "none":
        return {"allowed": False, "reason": "no_tier", "msg": "请购买套餐后使用"}
    if tier in ("monthly", "quarterly", "yearly"):
        try:
            if expires_at and date.fromisoformat(expires_at) < date.today():
                return {
                    "allowed": False,
                    "reason": "expired",
                    "msg": "套餐已过期，请续费",
                }
        except ValueError:
            return {"allowed": False, "reason": "invalid", "msg": "套餐信息异常"}
    return {"allowed": True, "tier": tier}


async def reset_password(security_answer: str, new_password: str) -> dict:
    cfg = load_or_create_config()
    return await call_server_api(
        "reset_password",
        method="POST",
        json_body={
            "username": cfg["username"],
            "security_answer": security_answer,
            "new_password": new_password,
        },
    )
