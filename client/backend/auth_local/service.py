# backend/auth_local/service.py
"""本地登录 + 30 天滚动验证"""

import json
import os
import platform
import hashlib
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import httpx

from config import SERVER_API_BASE

CONFIG_DIR = os.environ.get("DATA_ROOT", "./data")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
SESSION_DAYS = 30  # 登录后有效期


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
        "username": "",
        "pc_hash": "",
        "pc_name": "",
        "api_key": "",
        "api_base_url": "https://api.deepseek.com/anthropic",
        "api_model": "deepseek-v4-flash",
        "last_login_at": "",
        "token": "",
    }
    for k, v in defaults.items():
        if k not in cfg:
            cfg[k] = v
            changed = True
    if not cfg.get("pc_hash"):
        cfg["pc_hash"] = generate_pc_hash()
        cfg["pc_name"] = platform.node() or "My PC"
        changed = True
    # DEV_MODE: 自动创建用户
    if os.environ.get("DEV_MODE") and not cfg.get("username"):
        cfg["username"] = "devuser"
        cfg["last_login_at"] = datetime.now().isoformat()
        changed = True
    if changed:
        save_local_config(cfg)
    return cfg


def generate_pc_hash() -> str:
    """生成本机唯一标识

    优先使用 wmic 获取硬件序列号（Windows），
    失败时 fallback 到 hostname + 机器 SID。
    """
    info = []
    try:
        for wmic_query in ["cpu get ProcessorId", "baseboard get SerialNumber", "diskdrive get SerialNumber"]:
            try:
                result = subprocess.run(
                    ["wmic"] + wmic_query.split(),
                    capture_output=True, text=True, timeout=5
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
        # Fallback: hostname + machine SID
        try:
            info.append(platform.node() or "")
            result = subprocess.run(
                ["wmic", "os", "get", "SerialNumber"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")
                if len(lines) > 1:
                    info.append(lines[1].strip())
        except Exception:
            pass

    raw = "-".join(info) or platform.node() or "unknown"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


async def call_server_api(endpoint: str, payload: dict) -> dict:
    url = f"{SERVER_API_BASE}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            return resp.json()
    except httpx.TimeoutException:
        return {"code": -1, "msg": "网络超时"}
    except Exception as e:
        return {"code": -1, "msg": f"网络错误: {str(e)}"}


async def login(username: str, password: str) -> dict:
    """登录（首次：自动注册；已有：验证）"""
    if os.environ.get("DEV_MODE"):
        cfg = load_or_create_config()
        cfg["username"] = username
        cfg["last_login_at"] = datetime.now().isoformat()
        save_local_config(cfg)
        return {"code": 0, "data": {"message": "登录成功"}}

    payload = {"username": username, "password": password}
    result = await call_server_api("login", payload)
    if result.get("code") == 0:
        cfg = load_or_create_config()
        cfg["username"] = username
        cfg["last_login_at"] = datetime.now().isoformat()
        if "token" in result.get("data", {}):
            cfg["token"] = result["data"]["token"]
        save_local_config(cfg)
    return result


async def register(username: str, password: str, security_question: str, security_answer: str) -> dict:
    """首次注册（无激活码）"""
    if os.environ.get("DEV_MODE"):
        cfg = load_or_create_config()
        cfg["username"] = username
        cfg["last_login_at"] = datetime.now().isoformat()
        save_local_config(cfg)
        return {"code": 0, "data": {"message": "注册成功"}}

    payload = {
        "username": username,
        "password": password,
        "security_question": security_question,
        "security_answer": security_answer,
        "pc_hash": load_or_create_config()["pc_hash"],
        "pc_name": load_or_create_config()["pc_name"],
    }
    result = await call_server_api("register", payload)
    if result.get("code") == 0:
        cfg = get_local_config()
        cfg["username"] = username
        cfg["last_login_at"] = datetime.now().isoformat()
        save_local_config(cfg)
    return result


async def verify_session() -> dict:
    """验证登录会话是否在 30 天内"""
    cfg = load_or_create_config()
    username = cfg.get("username", "")
    last_login = cfg.get("last_login_at", "")

    if os.environ.get("DEV_MODE"):
        return {"valid": True, "username": username}

    if not username:
        return {"valid": False, "msg": "未登录"}
    if not last_login:
        return {"valid": False, "msg": "请重新登录"}

    # 检查 30 天窗口
    try:
        login_time = datetime.fromisoformat(last_login)
        if datetime.now() - login_time > timedelta(days=SESSION_DAYS):
            return {"valid": False, "msg": f"登录已超过 {SESSION_DAYS} 天，请重新登录"}
    except ValueError:
        return {"valid": False, "msg": "登录信息异常"}

    # 时钟回拨检测
    try:
        if datetime.now() < datetime.fromisoformat(last_login):
            return {"valid": False, "msg": "系统时间异常，请校准后重试"}
    except ValueError:
        pass

    return {"valid": True, "username": username, "expires_in_days": SESSION_DAYS}


async def refresh_session() -> dict:
    """尝试联网刷新会话（启动时静默调用）"""
    cfg = load_or_create_config()
    username = cfg.get("username", "")
    token = cfg.get("token", "")

    if not username or not token:
        return {"valid": False}

    result = await call_server_api("verify", {
        "username": username,
        "token": token,
        "pc_hash": cfg.get("pc_hash", ""),
    })
    if result.get("code") == 0 and result.get("data", {}).get("valid"):
        cfg["last_login_at"] = datetime.now().isoformat()
        save_local_config(cfg)
        return {"valid": True}
    return {"valid": False}


async def reset_password(security_answer: str, new_password: str) -> dict:
    """密保重置密码"""
    cfg = load_or_create_config()
    payload = {
        "username": cfg["username"],
        "security_answer": security_answer,
        "new_password": new_password,
    }
    return await call_server_api("reset_password", payload)
