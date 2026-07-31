# backend/auth_local/service.py
"""浏览器 OAuth 登录 + 30 天滚动验证"""

import base64
import hashlib
import json
import os
import platform
import subprocess
import urllib.parse
from datetime import UTC, date, datetime, timedelta

import httpx


# 从 config.json 读取 S端 API 地址，避免环境变量传递问题
def _get_server_api() -> str:
    cfg = get_local_config()
    return (
        cfg.get("server_api", "")
        or os.environ.get("SERVER_API_BASE")
        or "https://your-cloudbase-app.com/api"
    )


def _get_public_server_api() -> str:
    """宿主可访问的 S端 API 地址（前端打开授权页用）；默认与 SERVER_API_BASE 一致"""
    cfg = get_local_config()
    return (
        cfg.get("public_server_api", "")
        or os.environ.get("PUBLIC_SERVER_API")
        or _get_server_api()
    )


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
    except OSError:
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
        "username": "",
        "tier": "none",
        "expires_at": "",
        "last_login_at": "",
        "server_api": "",
    }
    for k, v in defaults.items():
        if k not in cfg:
            cfg[k] = v
            changed = True
    if not cfg.get("pc_hash"):
        cfg["pc_hash"] = generate_pc_hash()
        cfg["pc_name"] = platform.node() or "My PC"
        changed = True
    # 环境变量中的 SERVER_API_BASE 同步到 config.json（持久化）
    if os.environ.get("SERVER_API_BASE") and not cfg.get("server_api"):
        cfg["server_api"] = os.environ["SERVER_API_BASE"]
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
                    check=False,
                )
                if result.returncode == 0:
                    lines = result.stdout.strip().split("\n")
                    if len(lines) > 1:
                        val = lines[1].strip()
                        if val:
                            info.append(val)
            except OSError:
                continue
    except OSError:
        pass
    if not info:
        try:
            info.append(platform.node() or "")
            result = subprocess.run(
                ["wmic", "os", "get", "SerialNumber"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")
                if len(lines) > 1:
                    info.append(lines[1].strip())
        except OSError:
            pass
    raw = "-".join(info) or platform.node() or "unknown"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def collect_device_profile() -> dict:
    """采集当前设备硬件信息，构造 DeviceProfile"""
    info = []
    for wmic_query in [
        "cpu get ProcessorId",
        "baseboard get SerialNumber",
        "diskdrive get SerialNumber",
    ]:
        try:
            result = subprocess.run(
                ["wmic"] + wmic_query.split(),
                capture_output=True, text=True, timeout=5, check=False
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")
                if len(lines) > 1:
                    val = lines[1].strip()
                    if val:
                        info.append(val)
        except (OSError, subprocess.TimeoutExpired):
            continue

    raw = "-".join(info) or platform.node() or "unknown"
    fingerprint = hashlib.sha256(raw.encode()).hexdigest()

    return {
        "fingerprint": fingerprint,
        "hostname": platform.node() or "",
        "os": platform.platform() or "",
        "os_arch": platform.machine() or "",
    }


def encode_device_profile(device_info: dict) -> str:
    """DeviceProfile → URL-safe Base64（无 padding）"""
    payload = {
        "f": device_info.get("fingerprint", ""),
        "h": device_info.get("hostname", ""),
        "o": device_info.get("os", ""),
        "a": device_info.get("os_arch", ""),
    }
    raw = json.dumps(payload, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


async def call_server_api(
    endpoint: str,
    method: str = "GET",
    params: dict | None = None,
    json_body: dict | None = None,
) -> dict:
    url = f"{_get_server_api()}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if method == "GET":
                resp = await client.get(url, params=params)
            else:
                resp = await client.post(url, json=json_body)
            return resp.json()
    except httpx.TimeoutException:
        return {"code": -1, "msg": "网络超时"}
    except httpx.RequestError as e:
        return {"code": -1, "msg": f"网络错误: {e!s}"}


async def browser_auth(silent: bool = False) -> dict:
    """打开系统浏览器让用户在 S端 登录，后台轮询授权结果

    silent=True 时只静默检测是否已授权，不打开浏览器、不轮询
    """
    cfg = load_or_create_config()
    pc_hash = cfg["pc_hash"]

    # 静默模式：只查一次，不打开浏览器
    if silent:
        result = await call_server_api("check-auth", params={"pc_hash": pc_hash})
        if result.get("code") == 0:
            data = result["data"]
            cfg["token"] = data["token"]
            cfg["username"] = data.get("username", "")
            cfg["tier"] = data.get("tier", "none")
            cfg["expires_at"] = data.get("expires_at", "")
            cfg["last_login_at"] = datetime.now(UTC).isoformat()
            save_local_config(cfg)
            await _ensure_local_user(cfg["username"])
            return {
                "code": 0,
                "data": {
                    "message": "已登录",
                    "tier": cfg["tier"],
                    "token": cfg["token"],
                },
            }
        return {"code": 1, "data": {"message": "未登录"}}

    # 采集设备信息并编码为 device_profile
    device_info = collect_device_profile()
    device_profile = encode_device_profile(device_info)

    # 构造授权页 URL（宿主可访问地址，由前端在宿主浏览器打开）
    pc_name = cfg.get("pc_name", "")
    auth_url = (
        f"{_get_public_server_api()}/auth-page"
        f"?pc_hash={pc_hash}"
        f"&pc_name={urllib.parse.quote(pc_name)}"
        f"&device_profile={device_profile}"
    )
    return {"code": 1, "data": {"auth_url": auth_url, "message": "请在浏览器中完成登录"}}


async def verify_session() -> dict:
    """验证 30 天会话，返回套餐和剩余试用天数"""
    cfg = load_or_create_config()
    token = cfg.get("token", "")
    last_login = cfg.get("last_login_at", "")
    expires_at = cfg.get("expires_at", "")

    if not token:
        return {"valid": False, "msg": "未登录"}

    try:
        login_time = datetime.fromisoformat(last_login) if last_login else None
        if login_time and login_time.tzinfo is None:
            login_time = login_time.replace(tzinfo=UTC)
        if login_time and datetime.now(UTC) - login_time > timedelta(days=SESSION_DAYS):
            return {"valid": False, "msg": f"登录已超过 {SESSION_DAYS} 天，请重新登录"}
    except ValueError:
        return {"valid": False, "msg": "登录信息异常"}

    if login_time and datetime.now(UTC) < login_time:
        return {"valid": False, "msg": "系统时间异常"}

    # 计算剩余天数
    trial_days = 7
    if expires_at:
        try:
            expiry = date.fromisoformat(expires_at[:10])
            trial_days = max(0, (expiry - datetime.now(UTC).date()).days)
        except ValueError:
            pass

    return {
        "valid": True,
        "tier": cfg.get("tier", "none"),
        "trial_remaining_days": trial_days,
    }


def check_permission(now: date | None = None) -> dict:
    """检查当前用户套餐权限

    免费用户 allowed=True，带 project_limit=1。
    新用户默认 7 天 AI 试用（expires_at 为空时）。
    """
    cfg = get_local_config()
    tier = cfg.get("tier", "none")
    expires_at = cfg.get("expires_at", "")
    now = now or datetime.now(UTC).date()

    # 免费层
    if tier == "none":
        trial_days = 7
        if expires_at:
            try:
                expiry = date.fromisoformat(expires_at[:10])
                trial_days = max(0, (expiry - now).days)
            except ValueError:
                pass
        return {
            "allowed": True,
            "tier": "none",
            "project_limit": 1,
            "trial_remaining_days": trial_days,
        }

    # 付费套餐
    if tier in ("monthly", "quarterly", "yearly"):
        try:
            if expires_at and date.fromisoformat(expires_at[:10]) < now:
                return {
                    "allowed": False,
                    "reason": "expired",
                    "msg": "套餐已过期，请续费",
                }
        except ValueError:
            return {"allowed": False, "reason": "invalid", "msg": "套餐信息异常"}

    return {"allowed": True, "tier": tier}


async def _ensure_local_user(username: str) -> None:
    """Ensure the OAuth-authenticated S端 user exists in C端's local DB."""
    if not username:
        return
    try:
        from db import async_session
        from models.user import User

        async with async_session() as session:
            from sqlalchemy import select

            existing = await session.execute(select(User).where(User.id == username))
            if not existing.scalar_one_or_none():
                session.add(
                    User(
                        id=username,
                        email=f"{username}@s.local",
                        password_hash="*",
                        display_name=username,
                    )
                )
                await session.commit()
    except Exception:  # noqa: S110
        pass
