"""设备注册与激活管理 — Unit 6 + API 12 测试"""

import json
import base64 as b64
import sqlite3
import hashlib
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from jose import jwt as jose_jwt

# 将被测试模块加入 sys.path
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from local_server import (
    app,
    get_db,
    DB_PATH,
    init_db,
    decode_device_profile,
    encode_device_profile,
    register_device,
    compute_activation,
    get_user_tier_limit,
    _make_jwt,
    JWT_SECRET,
    JWT_ALGORITHM,
    hash_password,
)


# ============================================================
# 测试夹具
# ============================================================

@pytest.fixture
def db(tmp_path, monkeypatch):
    """每个测试一个独立的 SQLite 数据库文件"""
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("local_server.DB_PATH", db_file)
    # 重新 init_db 以在新路径上建表
    init_db()
    return db_file


@pytest.fixture
def client(db):
    """使用独立数据库的 FastAPI TestClient"""
    return TestClient(app)


def seed_user(conn, username: str):
    """插入测试用户"""
    pw_hash = hash_password("test123")
    conn.execute(
        "INSERT OR IGNORE INTO users (username, password_hash, status) VALUES (?, ?, 'active')",
        (username, pw_hash)
    )
    conn.commit()


def seed_code(conn, username: str, tier: str = "free"):
    """插入测试激活码（决定用户套餐）"""
    conn.execute(
        "INSERT OR IGNORE INTO codes (code_id, tier, duration_days, status, bound_username, activated_at, expires_at) VALUES (?, ?, ?, 'active', ?, date('now'), date('now', '+30 days'))",
        (f"code_{username}", tier, 30, username)
    )
    conn.commit()


def seed_device(conn, user_id: str, fingerprint: str, last_active_at: str = None, hostname: str = "测试机"):
    """预置设备记录"""
    if last_active_at is None:
        last_active_at = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO device_registry (user_id, fingerprint, hostname, os, os_arch, last_active_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, fingerprint, hostname, "Windows 11", "x86_64", last_active_at)
    )
    conn.commit()


def seed_auth_token(conn, pc_hash: str, username: str, tier: str = "free", enrolled: int = 0, fingerprint: str = ""):
    """预置授权记录"""
    conn.execute(
        "INSERT INTO auth_tokens (pc_hash, username, token, tier, enrolled, fingerprint) VALUES (?, ?, 'test-token', ?, ?, ?)",
        (pc_hash, username, tier, enrolled, fingerprint)
    )
    conn.commit()


def device_dict(fingerprint: str, last_active: str, updated: str = None, id_str: str = None):
    """构造 compute_activation 用的设备字典"""
    return {
        "fingerprint": fingerprint,
        "last_active_at": last_active,
        "updated_at": updated or last_active,
        "id": id_str or fingerprint,
    }


# ============================================================
# Unit 测试（6 条）
# ============================================================

class TestComputeActivation:
    """ActivationService.compute() 核心逻辑"""

    def test_top_2_of_3(self):
        """UT-1: 3 台设备，限额 2"""
        devices = [
            device_dict("A", "2026-07-28T14:00:00Z"),
            device_dict("B", "2026-07-27T10:00:00Z"),
            device_dict("C", "2026-07-26T08:00:00Z"),
        ]
        result_a = compute_activation(devices, 2, "A", "free")
        assert result_a["activated"] is True
        assert result_a["activated_count"] == 2
        assert result_a["total_count"] == 3

        result_c = compute_activation(devices, 2, "C", "free")
        assert result_c["activated"] is False
        assert result_c["reason"]["code"] == "limit_exceeded"

    def test_sort_updated_at_tiebreaker(self):
        """UT-2: last_active_at 相同，updated_at 不同"""
        devices = [
            device_dict("A", "2026-07-28T14:00:00Z", "2026-07-28T14:00:01Z", "1"),
            device_dict("B", "2026-07-28T14:00:00Z", "2026-07-28T13:59:00Z", "2"),
        ]
        result_a = compute_activation(devices, 1, "A", "free")
        assert result_a["activated"] is True
        result_b = compute_activation(devices, 1, "B", "free")
        assert result_b["activated"] is False

    def test_sort_id_tiebreaker(self):
        """UT-3: last_active_at 和 updated_at 都相同"""
        devices = [
            device_dict("A", "2026-07-28T14:00:00Z", "2026-07-28T14:00:00Z", "A-002"),
            device_dict("B", "2026-07-28T14:00:00Z", "2026-07-28T14:00:00Z", "A-001"),
        ]
        result_a = compute_activation(devices, 1, "A", "free")
        assert result_a["activated"] is True
        result_b = compute_activation(devices, 1, "B", "free")
        assert result_b["activated"] is False

    def test_account_inactive_all_deactivated(self):
        """UT-4: 无套餐用户（tier=none）所有设备未激活"""
        devices = [device_dict("A", "2026-07-28T14:00:00Z")]
        result = compute_activation(devices, 0, "A", "none")
        assert result["activated"] is False
        assert result["reason"]["code"] == "account_inactive"
        assert result["active_limit"] == 0
        assert result["activated_count"] == 0

    def test_empty_device_list(self):
        """UT-5: 空设备列表"""
        result = compute_activation([], 1, "", "free")
        assert result["activated"] is False
        assert result["total_count"] == 0
        assert result["activated_count"] == 0

    def test_tier_limit_mapping(self):
        """UT-6: get_user_tier_limit 映射正确"""
        assert get_user_tier_limit("none") == 0
        assert get_user_tier_limit("trial") == 1
        assert get_user_tier_limit("free") == 1
        assert get_user_tier_limit("monthly") == 3
        assert get_user_tier_limit("quarterly") == 3
        assert get_user_tier_limit("yearly") == 5
        assert get_user_tier_limit("unknown") == 1  # fallback


# ============================================================
# API 测试（12 条）
# ============================================================

class TestAuthorizeAPI:
    """POST /api/authorize"""

    def test_new_device_registration(self, db):
        """API-1: 首次授权 → 创建设备记录 → enrolled=1"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_code(conn, "testuser", "free")
        conn.close()

        resp = TestClient(app).post("/api/authorize", json={
            "username": "testuser",
            "password": "test123",
            "pc_hash": "hash-001",
            "device_profile": "eyJmIjoiQUJDMTIzIiwiaCI6IlBDMSJ9",  # {"f":"ABC123","h":"PC1"}
        })
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

        conn = get_db()
        devices = conn.execute("SELECT * FROM device_registry").fetchall()
        assert len(devices) == 1
        assert devices[0]["fingerprint"] == "ABC123"
        assert devices[0]["hostname"] == "PC1"
        token = conn.execute("SELECT enrolled FROM auth_tokens WHERE pc_hash='hash-001'").fetchone()
        assert token["enrolled"] == 1
        conn.close()

    def test_duplicate_device_registration(self, db):
        """API-2: 重复授权 → 更新活动时间 → enrolled=0"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_code(conn, "testuser", "free")
        seed_device(conn, "testuser", "ABC123", last_active_at="2026-07-01T00:00:00Z")
        conn.close()

        resp = TestClient(app).post("/api/authorize", json={
            "username": "testuser",
            "password": "test123",
            "pc_hash": "hash-001",
            "device_profile": "eyJmIjoiQUJDMTIzIiwiaCI6IlBDMSJ9",
        })
        assert resp.status_code == 200

        conn = get_db()
        devices = conn.execute("SELECT * FROM device_registry").fetchall()
        assert len(devices) == 1
        assert devices[0]["last_active_at"] > "2026-07-01"
        token = conn.execute("SELECT enrolled FROM auth_tokens").fetchone()
        assert token["enrolled"] == 0
        conn.close()

    def test_no_device_profile(self, db):
        """API-3: 旧版 C端 不传 device_profile → 以无指纹设备注册"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_code(conn, "testuser", "free")
        conn.close()

        resp = TestClient(app).post("/api/authorize", json={
            "username": "testuser",
            "password": "test123",
            "pc_hash": "hash-001",
        })
        assert resp.status_code == 200

        conn = get_db()
        devices = conn.execute("SELECT * FROM device_registry").fetchall()
        assert len(devices) == 1
        assert devices[0]["fingerprint"] == ""
        conn.close()

    def test_device_profile_decode_failed(self, db):
        """API-4: 非法 Base64 → 指纹为空，不阻断授权"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_code(conn, "testuser", "free")
        conn.close()

        resp = TestClient(app).post("/api/authorize", json={
            "username": "testuser",
            "password": "test123",
            "pc_hash": "hash-001",
            "device_profile": "!!!not-base64!!!",
        })
        assert resp.status_code == 200

        conn = get_db()
        devices = conn.execute("SELECT * FROM device_registry").fetchall()
        assert len(devices) == 1
        assert devices[0]["fingerprint"] == ""
        conn.close()

    def test_no_fingerprint_limit(self, db):
        """API-5: 无指纹设备超限 → 复用已有记录"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_code(conn, "testuser", "free")
        seed_device(conn, "testuser", "", last_active_at="2026-07-01T00:00:00Z", hostname="Old-PC")
        conn.close()

        # {"f":"","h":"New-PC"}
        profile_b64 = b64.urlsafe_b64encode(json.dumps({"f": "", "h": "New-PC"}).encode()).decode().rstrip("=")

        resp = TestClient(app).post("/api/authorize", json={
            "username": "testuser",
            "password": "test123",
            "pc_hash": "hash-001",
            "device_profile": profile_b64,
        })
        assert resp.status_code == 200

        conn = get_db()
        devices = conn.execute("SELECT * FROM device_registry").fetchall()
        assert len(devices) == 1
        assert devices[0]["hostname"] == "New-PC"
        conn.close()


class TestDevicesCurrentAPI:
    """GET /api/devices/current"""

    def test_activated(self, db):
        """API-6: 设备在 top N 内 → activated=true"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_device(conn, "testuser", "FP-A")
        seed_auth_token(conn, "hash-001", "testuser", tier="free")
        conn.close()

        resp = TestClient(app).get(
            "/api/devices/current?pc_hash=hash-001",
            headers={"Authorization": f"Bearer {_make_jwt('testuser')}"},
        )
        data = resp.json()
        assert data["activated"] is True
        assert data["device_count"] == 1
        assert data["active_limit"] == 1

    def test_deactivated_limit_exceeded(self, db):
        """API-7: 设备不在 top N 内 → activated=false, reason=limit_exceeded"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_device(conn, "testuser", "FP-A", last_active_at="2026-07-28T14:00:00Z")
        seed_device(conn, "testuser", "FP-B", last_active_at="2026-07-27T10:00:00Z")
        seed_device(conn, "testuser", "FP-C", last_active_at="2026-07-26T08:00:00Z")
        # FP-C 是当前设备（通过 fingerprint 标记），但限额 1 所以只有 FP-A 激活
        seed_auth_token(conn, "hash-001", "testuser", tier="free", fingerprint="FP-C")  # free=1
        conn.close()

        resp = TestClient(app).get(
            "/api/devices/current?pc_hash=hash-001",
            headers={"Authorization": f"Bearer {_make_jwt('testuser')}"},
        )
        data = resp.json()
        assert data["activated"] is False
        assert data["reason"]["code"] == "limit_exceeded"

    def test_account_inactive(self, db):
        """API-8: 账号无套餐 → activated=false, reason=account_inactive"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_device(conn, "testuser", "FP-A")
        seed_auth_token(conn, "hash-001", "testuser", tier="none")
        conn.close()

        resp = TestClient(app).get(
            "/api/devices/current?pc_hash=hash-001",
            headers={"Authorization": f"Bearer {_make_jwt('testuser')}"},
        )
        data = resp.json()
        assert data["activated"] is False
        assert data["reason"]["code"] == "account_inactive"


class TestDevicesListAPI:
    """GET /api/devices"""

    def test_mixed_status(self, db):
        """API-9: 设备列表混合状态"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_device(conn, "testuser", "FP-A", last_active_at="2026-07-28T14:00:00Z", hostname="主开发机")
        seed_device(conn, "testuser", "FP-B", last_active_at="2026-07-27T10:00:00Z", hostname="办公本")
        seed_device(conn, "testuser", "FP-C", last_active_at="2026-07-26T08:00:00Z", hostname="老台式机")
        seed_auth_token(conn, "hash-001", "testuser", tier="free")  # free=1
        conn.close()

        resp = TestClient(app).get(
            "/api/devices",
            headers={"Authorization": f"Bearer {_make_jwt('testuser')}"},
        )
        data = resp.json()
        assert data["total_count"] == 3
        assert data["activated_count"] == 1
        assert data["active_limit"] == 1

        devices = {d["hostname"]: d["activated"] for d in data["devices"]}
        assert devices["主开发机"] is True
        assert devices["办公本"] is False
        assert devices["老台式机"] is False

        fp_b = [d for d in data["devices"] if d["hostname"] == "办公本"][0]
        assert fp_b["reason"]["code"] == "limit_exceeded"

    def test_empty_list(self, db):
        """API-10: 无设备时返回空数组"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_auth_token(conn, "hash-001", "testuser")
        conn.close()

        resp = TestClient(app).get(
            "/api/devices",
            headers={"Authorization": f"Bearer {_make_jwt('testuser')}"},
        )
        data = resp.json()
        assert data["devices"] == []
        assert data["total_count"] == 0
        assert data["activated_count"] == 0

    def test_paid_tier_limit_3(self, db):
        """API-9b: 付费用户限额 3，3 台全部激活"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_device(conn, "testuser", "FP-A", last_active_at="2026-07-28T14:00:00Z", hostname="主开发机")
        seed_device(conn, "testuser", "FP-B", last_active_at="2026-07-27T10:00:00Z", hostname="办公本")
        seed_device(conn, "testuser", "FP-C", last_active_at="2026-07-26T08:00:00Z", hostname="老台式机")
        seed_auth_token(conn, "hash-001", "testuser", tier="monthly")  # monthly=3
        conn.close()

        resp = TestClient(app).get(
            "/api/devices",
            headers={"Authorization": f"Bearer {_make_jwt('testuser')}"},
        )
        data = resp.json()
        assert data["total_count"] == 3
        assert data["activated_count"] == 3
        assert data["active_limit"] == 3
        all_activated = all(d["activated"] for d in data["devices"])
        assert all_activated is True


class TestConsumeEnrolledAPI:
    """POST /api/devices/consume-enrolled"""

    def test_consume_enrolled(self, db):
        """API-11: 消费后 enrolled 置 0"""
        conn = get_db()
        seed_user(conn, "testuser")
        seed_auth_token(conn, "hash-001", "testuser", enrolled=1)
        conn.close()

        resp = TestClient(app).post(
            "/api/devices/consume-enrolled?pc_hash=hash-001",
            headers={"Authorization": f"Bearer {_make_jwt('testuser')}"},
        )
        assert resp.json()["code"] == 0

        conn = get_db()
        token = conn.execute("SELECT enrolled FROM auth_tokens WHERE pc_hash='hash-001'").fetchone()
        assert token["enrolled"] == 0
        conn.close()


class TestAuthAPI:
    """GET /api/devices/current — 401 未认证"""

    def test_unauthorized(self, db):
        """API-12: 未提供 JWT 返回 401"""
        resp = TestClient(app).get("/api/devices/current?pc_hash=hash-001")
        assert resp.status_code == 401
        assert resp.json()["code"] == -1

    def test_devices_list_unauthorized(self, db):
        """API-12b: GET /api/devices 未认证返回 401"""
        resp = TestClient(app).get("/api/devices")
        assert resp.status_code == 401
        assert resp.json()["code"] == -1


# ============================================================
# 编解码测试（补充）
# ============================================================

class TestProfileCodec:
    """DeviceProfile 编解码"""

    def test_roundtrip(self):
        """编解码往返一致"""
        original = {"fingerprint": "FP-001", "hostname": "PC1", "os": "Windows", "os_arch": "x86_64"}
        encoded = encode_device_profile(original)
        decoded = decode_device_profile(encoded)
        assert decoded["fingerprint"] == "FP-001"
        assert decoded["hostname"] == "PC1"
        assert decoded["os"] == "Windows"
        assert decoded["os_arch"] == "x86_64"

    def test_empty_input(self):
        """空字符串返回空字段"""
        decoded = decode_device_profile("")
        assert decoded["fingerprint"] == ""
        assert decoded["hostname"] == ""

    def test_missing_padding(self):
        """缺少 padding 的 Base64 正常解码"""
        original = {"fingerprint": "FP-002", "h": "PC2"}
        encoded = encode_device_profile(original).rstrip("=")
        assert "=" not in encoded
        decoded = decode_device_profile(encoded)
        assert decoded["fingerprint"] == "FP-002"

    def test_invalid_base64(self):
        """非法 Base64 返回空字段"""
        decoded = decode_device_profile("!!!not-base64!!!")
        assert decoded["fingerprint"] == ""

    def test_valid_base64_not_json(self):
        """合法 Base64 但非 JSON 返回空字段"""
        encoded = b64.urlsafe_b64encode(b"not-json").decode()
        decoded = decode_device_profile(encoded)
        assert decoded["fingerprint"] == ""

    def test_missing_fields(self):
        """缺少字段时默认空字符串"""
        encoded = b64.urlsafe_b64encode(json.dumps({"unknown": "value"}).encode()).decode()
        decoded = decode_device_profile(encoded)
        assert decoded["fingerprint"] == ""
        assert decoded["hostname"] == ""
