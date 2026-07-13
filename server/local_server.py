# serverless/local_server.py
"""本地 S 端模拟服务器 — 用于开发测试

在没有部署 CloudBase 时，启动此服务器模拟 S 端 API。
所有数据存储在本地 SQLite 数据库 serverless_local.db。

用法:
    cd d:/code/ai-novel
    python serverless/local_server.py

S 端 API 地址: http://127.0.0.1:19000/api
C 端 config.json 中的 SERVER_API_BASE 需指向此地址。
"""

import os
import sys
import json
import secrets
import string
import hashlib
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from functools import wraps

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ── 数据库 ──

DB_PATH = Path(__file__).parent / "serverless_local.db"


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            security_question TEXT DEFAULT '',
            security_answer_hash TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS codes (
            code_id TEXT PRIMARY KEY,
            tier TEXT NOT NULL,
            duration_days INTEGER NOT NULL,
            status TEXT DEFAULT 'unused',
            bound_username TEXT,
            activated_at TEXT,
            expires_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            created_by TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            pc_hash TEXT NOT NULL,
            pc_name TEXT DEFAULT '',
            last_active_at TEXT,
            bound_at TEXT DEFAULT (datetime('now')),
            activation_code TEXT DEFAULT '',
            UNIQUE(username, pc_hash)
        );
        CREATE TABLE IF NOT EXISTS global_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)
    # 默认配置
    conn.execute("INSERT OR IGNORE INTO global_config VALUES ('heartbeat_grace_days', '90')")
    conn.execute("INSERT OR IGNORE INTO global_config VALUES ('max_devices', '3')")
    conn.commit()
    conn.close()


# ── 工具函数 ──

def generate_activation_code() -> str:
    def _block(length=4):
        chars = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))
    parts = [_block() for _ in range(4)]
    return f"AC-{'-'.join(parts)}"


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hashlib.sha256(plain.encode()).hexdigest() == hashed


def calc_expires_at(tier: str, from_date: date = None) -> date:
    duration_map = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
    days = duration_map.get(tier, 30)
    base = from_date or date.today()
    return base + timedelta(days=days)


# ── FastAPI 路由 ──

app = FastAPI(title="AI Novel - Local S Server", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 请求模型
class ActivateRequest(BaseModel):
    activation_code: str
    username: str
    password: str
    security_question: str = ""
    security_answer: str = ""
    pc_hash: str
    pc_name: str = ""

class LoginRequest(BaseModel):
    username: str
    password: str
    pc_hash: str
    pc_name: str = ""

class VerifyRequest(BaseModel):
    username: str
    token: str
    pc_hash: str

class RenewRequest(BaseModel):
    username: str
    token: str
    activation_code: str
    pc_hash: str = ""

class DeviceListRequest(BaseModel):
    username: str
    token: str

class DeviceRemoveRequest(BaseModel):
    username: str
    token: str
    pc_hash: str

class ResetPasswordRequest(BaseModel):
    username: str
    security_answer: str
    new_password: str

class GenerateCodeRequest(BaseModel):
    admin_token: str
    tier: str = "monthly"
    count: int = 1

class QueryCodesRequest(BaseModel):
    admin_token: str
    username: str = ""

ADMIN_TOKEN = "admin123"  # 本地测试用


def list_devices(username: str) -> list:
    conn = get_db()
    rows = conn.execute("SELECT pc_hash, pc_name, last_active_at, bound_at FROM devices WHERE username=?", (username,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_license_expiry(username: str):
    conn = get_db()
    rows = conn.execute("SELECT expires_at, tier FROM codes WHERE bound_username=? AND status='active'", (username,)).fetchall()
    conn.close()
    max_expires = None
    tiers = set()
    for r in rows:
        if r["expires_at"]:
            exp = date.fromisoformat(r["expires_at"])
            if max_expires is None or exp > max_expires:
                max_expires = exp
            tiers.add(r["tier"])
    return max_expires, tiers


@app.post("/api/activate")
async def api_activate(req: ActivateRequest):
    try:
        conn = get_db()
        code = req.activation_code.strip().upper()
        username = req.username.strip()
        password = req.password

        # 检查用户名
        existing = conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone()
        if existing:
            conn.close()
            return {"code": 1, "msg": "用户名已存在"}

        # 检查激活码
        code_row = conn.execute("SELECT * FROM codes WHERE code_id=?", (code,)).fetchone()
        if not code_row:
            conn.close()
            return {"code": 1, "msg": "无效的激活码"}
        if code_row["status"] != "unused":
            conn.close()
            return {"code": 1, "msg": "激活码已被使用"}

        # 创建用户
        conn.execute(
            "INSERT INTO users (username, password_hash, security_question, security_answer_hash, status) VALUES (?, ?, ?, ?, 'active')",
            (username, hash_password(password), req.security_question, hash_password(req.security_answer))
        )

        # 更新激活码
        expires_at = calc_expires_at(code_row["tier"])
        conn.execute(
            "UPDATE codes SET status='active', bound_username=?, activated_at=date('now'), expires_at=? WHERE code_id=?",
            (username, expires_at.isoformat(), code)
        )

        # 绑定设备
        conn.execute(
            "INSERT OR IGNORE INTO devices (username, pc_hash, pc_name, last_active_at, bound_at, activation_code) VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)",
            (username, req.pc_hash, req.pc_name, code)
        )

        conn.commit()
        conn.close()

        devices = list_devices(username)
        return {
            "code": 0,
            "data": {
                "token": f"local-token-{username}",
                "tier": code_row["tier"],
                "expires_at": expires_at.isoformat(),
                "devices": devices,
            }
        }
    except Exception as e:
        return {"code": -1, "msg": str(e)}


@app.post("/api/login")
async def api_login(req: LoginRequest):
    try:
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE username=?", (req.username.strip(),)).fetchone()
        if not user or not verify_password(req.password, user["password_hash"]):
            conn.close()
            return {"code": 1, "msg": "用户名或密码错误"}
        if user["status"] != "active":
            conn.close()
            return {"code": 1, "msg": "账户已被锁定"}

        # 检查到期日
        max_expires, tiers = get_license_expiry(user["username"])
        if not max_expires or max_expires < date.today():
            conn.close()
            return {"code": 1, "msg": "License 已过期"}

        # 检查设备
        existing = conn.execute("SELECT * FROM devices WHERE username=? AND pc_hash=?", (user["username"], req.pc_hash)).fetchone()
        if existing:
            conn.execute("UPDATE devices SET last_active_at=datetime('now') WHERE username=? AND pc_hash=?", (user["username"], req.pc_hash))
        else:
            device_count = conn.execute("SELECT COUNT(*) as cnt FROM devices WHERE username=?", (user["username"],)).fetchone()["cnt"]
            if device_count >= 3:
                conn.close()
                return {"code": 2, "msg": "已超过最大设备数（3 台），请先在旧设备上解绑"}
            conn.execute(
                "INSERT INTO devices (username, pc_hash, pc_name, last_active_at, bound_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
                (user["username"], req.pc_hash, req.pc_name)
            )

        conn.commit()
        devices = list_devices(user["username"])
        conn.close()
        return {
            "code": 0,
            "data": {
                "token": f"local-token-{user['username']}",
                "expires_at": max_expires.isoformat(),
                "tier": ", ".join(sorted(tiers)),
                "devices": devices,
            }
        }
    except Exception as e:
        return {"code": -1, "msg": str(e)}


@app.post("/api/verify")
async def api_verify(req: VerifyRequest):
    try:
        if not req.token.startswith("local-token-"):
            return {"code": 2, "msg": "Token 无效"}
        if req.username not in req.token:
            return {"code": 2, "msg": "Token 和用户名不匹配"}

        conn = get_db()
        max_expires, tiers = get_license_expiry(req.username)
        if not max_expires:
            conn.close()
            return {"code": 1, "msg": "没有活跃的 License"}

        valid = max_expires >= date.today()

        device = conn.execute("SELECT * FROM devices WHERE username=? AND pc_hash=?", (req.username, req.pc_hash)).fetchone()
        device_valid = device is not None
        if device:
            conn.execute("UPDATE devices SET last_active_at=datetime('now') WHERE username=? AND pc_hash=?", (req.username, req.pc_hash))

        all_devices = conn.execute("SELECT pc_hash, pc_name, last_active_at, bound_at FROM devices WHERE username=?", (req.username,)).fetchall()
        conn.commit()
        conn.close()
        return {
            "code": 0,
            "data": {
                "valid": valid and device_valid,
                "license_valid": valid,
                "device_valid": device_valid,
                "expires_at": max_expires.isoformat(),
                "tier": ", ".join(sorted(tiers)),
                "devices": [dict(d) for d in all_devices],
                "max_devices": 3,
            }
        }
    except Exception as e:
        return {"code": -1, "msg": str(e)}


@app.post("/api/renew")
async def api_renew(req: RenewRequest):
    try:
        conn = get_db()
        code = req.activation_code.strip().upper()
        code_row = conn.execute("SELECT * FROM codes WHERE code_id=?", (code,)).fetchone()
        if not code_row:
            conn.close()
            return {"code": 1, "msg": "无效的激活码"}
        if code_row["status"] != "unused":
            conn.close()
            return {"code": 1, "msg": "激活码已被使用"}

        max_expires, _ = get_license_expiry(req.username)
        base = max(max_expires, date.today()) if max_expires else date.today()
        duration_map = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
        days = duration_map.get(code_row["tier"], 30)
        new_expires = base + timedelta(days=days)

        conn.execute(
            "UPDATE codes SET status='active', bound_username=?, activated_at=date('now'), expires_at=? WHERE code_id=?",
            (req.username, new_expires.isoformat(), code)
        )
        conn.commit()
        conn.close()
        return {"code": 0, "data": {"new_expires_at": new_expires.isoformat()}}
    except Exception as e:
        return {"code": -1, "msg": str(e)}


@app.post("/api/devices/list")
async def api_devices_list(req: DeviceListRequest):
    devices = list_devices(req.username)
    return {"code": 0, "data": {"devices": devices, "max_devices": 3}}


@app.post("/api/devices/remove")
async def api_devices_remove(req: DeviceRemoveRequest):
    conn = get_db()
    conn.execute("DELETE FROM devices WHERE username=? AND pc_hash=?", (req.username, req.pc_hash))
    conn.commit()
    conn.close()
    return {"code": 0, "data": {"success": True}}


@app.post("/api/reset_password")
async def api_reset_password(req: ResetPasswordRequest):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username=?", (req.username.strip(),)).fetchone()
    if not user:
        conn.close()
        return {"code": 1, "msg": "用户不存在"}
    if not verify_password(req.security_answer, user["security_answer_hash"]):
        conn.close()
        return {"code": 1, "msg": "密保答案错误"}
    conn.execute("UPDATE users SET password_hash=? WHERE username=?", (hash_password(req.new_password), req.username.strip()))
    conn.commit()
    conn.close()
    return {"code": 0, "data": {"success": True}}


@app.post("/api/generate_code")
async def api_generate_code(req: GenerateCodeRequest):
    if req.admin_token != ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}
    if req.tier not in ("monthly", "quarterly", "yearly", "lifetime"):
        return {"code": 1, "msg": "无效的套餐类型"}
    if req.count < 1 or req.count > 100:
        return {"code": 1, "msg": "生成数量 1-100"}

    duration_map = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
    conn = get_db()
    generated = []
    for _ in range(req.count):
        code_id = generate_activation_code()
        conn.execute(
            "INSERT INTO codes (code_id, tier, duration_days, status, created_by) VALUES (?, ?, ?, 'unused', 'local_admin')",
            (code_id, req.tier, duration_map[req.tier])
        )
        generated.append(code_id)
    conn.commit()
    conn.close()
    return {"code": 0, "data": {"codes": generated, "count": len(generated)}}


@app.post("/api/query_codes")
async def api_query_codes(req: QueryCodesRequest):
    if req.admin_token != ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}
    conn = get_db()
    if req.username:
        rows = conn.execute("SELECT * FROM codes WHERE bound_username=? ORDER BY created_at DESC", (req.username,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM codes ORDER BY created_at DESC LIMIT 200").fetchall()
    conn.close()
    code_list = [{
        "code_id": r["code_id"],
        "tier": r["tier"],
        "status": r["status"],
        "bound_username": r["bound_username"],
        "expires_at": r["expires_at"],
        "created_at": r["created_at"],
    } for r in rows]
    return {"code": 0, "data": {"codes": code_list}}


if __name__ == "__main__":
    init_db()
    print(f"本地 S 端服务器启动: http://127.0.0.1:19000")
    print(f"管理 Token: {ADMIN_TOKEN}")
    uvicorn.run(app, host="127.0.0.1", port=19000)
