# backend/auth_local/service.py
"""S 端通信层 — 调用 CloudBase API + 本地缓存管理"""

import json
import os
import platform
import hashlib
import subprocess
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

import httpx

from config import SERVER_API_BASE

# 本地配置文件
CONFIG_DIR = os.environ.get("DATA_ROOT", "./data")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
GRACE_DAYS = 90  # 未心跳宽限天数


def get_local_config() -> dict:
    """读取本地配置"""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def save_local_config(config: dict):
    """保存本地配置"""
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def load_or_create_config() -> dict:
    """加载配置，如不存在则创建默认"""
    cfg = get_local_config()
    changed = False
    defaults = {
        "username": "",
        "pc_hash": "",
        "pc_name": "",
        "api_key": "",
        "api_base_url": "https://api.deepseek.com/anthropic",
        "api_model": "deepseek-v4-flash",
        "tier": "",
        "expires_at": "",
        "last_verify_at": "",
        "locked": False,
    }
    for k, v in defaults.items():
        if k not in cfg:
            cfg[k] = v
            changed = True
    # 自动生成 PC hash（如果不存在）
    if not cfg.get("pc_hash"):
        cfg["pc_hash"] = generate_pc_hash()
        cfg["pc_name"] = platform.node() or "My PC"
        changed = True
    # DEV_MODE: 自动创建用户，跳过验证
    if os.environ.get("DEV_MODE") and not cfg.get("username"):
        cfg["username"] = "devuser"
        cfg["tier"] = "dev"
        cfg["expires_at"] = (date.today() + timedelta(days=3650)).isoformat()  # 10年
        cfg["last_verify_at"] = datetime.now().isoformat()
        cfg["locked"] = False
        changed = True
    if changed:
        save_local_config(cfg)
    return cfg


def generate_pc_hash() -> str:
    """生成本机唯一标识（CPU + 主板 + 磁盘的混合 hash）

    Windows 下使用 wmic 获取硬件信息，跨平台 fallback 到 hostname。
    """
    info = []
    try:
        # CPU ID
        result = subprocess.run(
            ["wmic", "cpu", "get", "ProcessorId"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            if len(lines) > 1:
                info.append(lines[1].strip())
        # 主板序列号
        result = subprocess.run(
            ["wmic", "baseboard", "get", "SerialNumber"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            if len(lines) > 1:
                info.append(lines[1].strip())
        # 磁盘序列号
        result = subprocess.run(
            ["wmic", "diskdrive", "get", "SerialNumber"],
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
    """调 S 端 CloudBase API"""
    url = f"{SERVER_API_BASE}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            return resp.json()
    except httpx.TimeoutException:
        return {"code": -1, "msg": "网络超时"}
    except Exception as e:
        return {"code": -1, "msg": f"网络错误: {str(e)}"}


async def activate(activation_code: str, username: str, password: str,
                   security_question: str, security_answer: str) -> dict:
    """激活码激活 + 注册"""
    cfg = load_or_create_config()
    payload = {
        "activation_code": activation_code,
        "username": username,
        "password": password,
        "security_question": security_question,
        "security_answer": security_answer,
        "pc_hash": cfg["pc_hash"],
        "pc_name": cfg["pc_name"],
    }
    result = await call_server_api("activate", payload)
    if result.get("code") == 0:
        data = result["data"]
        cfg["username"] = username
        cfg["token"] = data["token"]
        cfg["tier"] = data["tier"]
        cfg["expires_at"] = data["expires_at"]
        cfg["last_verify_at"] = datetime.now().isoformat()
        cfg["locked"] = False
        save_local_config(cfg)
    return result


async def login(username: str, password: str) -> dict:
    """登录验证"""
    # DEV_MODE: 跳过验证，直接返回成功
    if os.environ.get("DEV_MODE"):
        cfg = load_or_create_config()
        return {
            "code": 0,
            "data": {
                "token": "dev-token",
                "expires_at": cfg.get("expires_at", ""),
                "tier": "dev",
                "devices": [],
            }
        }
    cfg = load_or_create_config()
    payload = {
        "username": username,
        "password": password,
        "pc_hash": cfg["pc_hash"],
        "pc_name": cfg["pc_name"],
    }
    result = await call_server_api("login", payload)
    if result.get("code") == 0:
        data = result["data"]
        cfg["username"] = username
        cfg["token"] = data["token"]
        cfg["tier"] = data["tier"]
        cfg["expires_at"] = data["expires_at"]
        cfg["last_verify_at"] = datetime.now().isoformat()
        cfg["locked"] = False
        save_local_config(cfg)
    return result


async def verify_license() -> dict:
    """启动时验证 License，支持离线缓存"""
    cfg = load_or_create_config()

    # DEV_MODE: 跳过所有验证
    if os.environ.get("DEV_MODE"):
        return {"valid": True, "expires_at": cfg.get("expires_at", ""), "dev_mode": True}

    if not cfg.get("username") or not cfg.get("token"):
        return {"valid": False, "msg": "未激活"}

    # 先尝试联网验证
    payload = {
        "username": cfg["username"],
        "token": cfg["token"],
        "pc_hash": cfg["pc_hash"],
    }
    result = await call_server_api("verify", payload)

    now = datetime.now()

    if result.get("code") == 0:
        data = result["data"]
        if data.get("valid"):
            cfg["expires_at"] = data["expires_at"]
            cfg["last_verify_at"] = now.isoformat()
            cfg["locked"] = False
            save_local_config(cfg)
            return {"valid": True, "expires_at": data["expires_at"]}
        else:
            cfg["locked"] = True
            save_local_config(cfg)
            return {"valid": False, "msg": "License 无效或已过期"}

    # 联网验证失败，走本地缓存
    return verify_local_cache(cfg)


def verify_local_cache(cfg: dict) -> dict:
    """离线验证本地缓存"""
    if cfg.get("locked"):
        return {"valid": False, "msg": "License 已被锁定"}

    expires_at = cfg.get("expires_at", "")
    last_verify_at = cfg.get("last_verify_at", "")

    if not expires_at:
        return {"valid": False, "msg": "未检测到 License"}

    # 检查是否过期
    try:
        exp = date.fromisoformat(expires_at)
        if exp < date.today():
            return {"valid": False, "msg": "License 已过期"}
    except ValueError:
        return {"valid": False, "msg": "License 信息异常"}

    # 检查时钟回拨
    if last_verify_at:
        try:
            last = datetime.fromisoformat(last_verify_at)
            if datetime.now() < last:
                return {"valid": False, "msg": "系统时间异常，请校准时间后重试"}
        except ValueError:
            pass

    # 检查离线宽限期
    if last_verify_at:
        try:
            last = datetime.fromisoformat(last_verify_at)
            delta = datetime.now() - last
            if delta > timedelta(days=GRACE_DAYS):
                return {"valid": False, "msg": f"已超过 {GRACE_DAYS} 天未联网验证，请连接网络后重启"}
        except ValueError:
            pass

    return {"valid": True, "expires_at": expires_at}


async def renew(activation_code: str) -> dict:
    """续期"""
    cfg = load_or_create_config()
    payload = {
        "username": cfg["username"],
        "token": cfg["token"],
        "activation_code": activation_code,
        "pc_hash": cfg["pc_hash"],
    }
    result = await call_server_api("renew", payload)
    if result.get("code") == 0:
        cfg["expires_at"] = result["data"]["new_expires_at"]
        save_local_config(cfg)
    return result


async def list_devices() -> dict:
    """查看已绑定设备"""
    cfg = load_or_create_config()
    payload = {"username": cfg["username"], "token": cfg["token"]}
    return await call_server_api("devices/list", payload)


async def remove_device(pc_hash: str) -> dict:
    """解绑设备"""
    cfg = load_or_create_config()
    payload = {"username": cfg["username"], "token": cfg["token"], "pc_hash": pc_hash}
    return await call_server_api("devices/remove", payload)


async def reset_password(security_answer: str, new_password: str) -> dict:
    """密保重置密码"""
    cfg = load_or_create_config()
    payload = {
        "username": cfg["username"],
        "security_answer": security_answer,
        "new_password": new_password,
    }
    return await call_server_api("reset_password", payload)
