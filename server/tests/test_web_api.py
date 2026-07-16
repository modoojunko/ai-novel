"""S端 Web 页面 E2E 测试

前置条件: server/local_server.py 已在运行 (python server/local_server.py)
运行: cd server && python -m pytest tests/test_web_api.py -v

测试覆盖:
  - 静态页面加载 (200 OK)
  - 注册 → 登录 → 用户信息 (完整流程)
  - 激活码生成 → 绑定 → 验证套餐更新
  - 密码修改 → 用新密码登录
  - 密保修改
  - 设备管理
"""

import os
import random
import httpx
import pytest
import json
from datetime import date, timedelta

BASE = "http://127.0.0.1:19000"

# 清理旧测试数据（可选：删除测试数据库文件）
_TEST_DB = os.path.join(os.path.dirname(__file__), "..", "serverless_local.db")


# ── Fixtures ──

@pytest.fixture(scope="session")
def client():
    return httpx.Client(base_url=BASE, timeout=10)


@pytest.fixture
def unique() -> str:
    return f"{date.today().strftime('%m%d')}{random.randint(10000,99999)}"


@pytest.fixture
def test_user(client, unique) -> dict:
    """注册一个测试用户，返回 {token, username, password}"""
    username = f"e2e_{unique}"
    password = "TestPass123!"
    r = client.post("/api/web/register", json={
        "username": username,
        "password": password,
        "security_question": "你的宠物名字？",
        "security_answer": "旺财",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["code"] == 0
    assert "token" in data["data"]
    return {"username": username, "password": password, "token": data["data"]["token"]}


@pytest.fixture
def admin_token(client) -> str:
    """管理员 token（直接调用生成激活码 API）"""
    return "admin123"


# ── Tests ──


class TestStaticPages:
    """所有静态页面能正常加载"""

    @pytest.mark.parametrize("path", [
        "/", "/login.html", "/register.html", "/dashboard.html",
        "/license.html", "/activate.html", "/devices.html", "/account.html",
        "/style.css", "/api.js",
    ])
    def test_page_loads(self, client, path):
        r = client.get(path)
        assert r.status_code == 200, f"{path} returned {r.status_code}"
        assert len(r.text) > 50, f"{path} content too short"


class TestRegister:
    """注册流程"""

    def test_register_success(self, client):
        ts = date.today().strftime("%m%d%H%M%S")
        r = client.post("/api/web/register", json={
            "username": f"reg_{ts}",
            "password": "Pass123!",
            "security_question": "q?",
            "security_answer": "a",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 0
        assert len(data["data"]["token"]) == 32  # UUID hex, no dashes

    def test_register_duplicate_username(self, client, test_user):
        r = client.post("/api/web/register", json={
            "username": test_user["username"],
            "password": "Other123!",
            "security_question": "q?",
            "security_answer": "a",
        })
        assert r.status_code == 200
        assert r.json()["code"] == 1  # 用户名已存在

    def test_register_short_password(self, client):
        r = client.post("/api/web/register", json={
            "username": "shortpwd_test",
            "password": "123",  # 太短
            "security_question": "q?",
            "security_answer": "a",
        })
        # 服务端不强制密码长度（前端校验），但能注册
        assert r.status_code == 200


class TestLogin:
    """登录流程"""

    def test_login_success(self, client, test_user):
        r = client.post("/api/web/login", json={
            "username": test_user["username"],
            "password": test_user["password"],
        })
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 0
        assert len(data["data"]["token"]) == 32

    def test_login_wrong_password(self, client, test_user):
        r = client.post("/api/web/login", json={
            "username": test_user["username"],
            "password": "WrongPassword!",
        })
        assert r.status_code == 200
        assert r.json()["code"] == 1
        assert "错误" in r.json()["msg"]

    def test_login_nonexistent_user(self, client):
        r = client.post("/api/web/login", json={
            "username": "no_such_user_99999",
            "password": "anything",
        })
        assert r.status_code == 200
        assert r.json()["code"] == 1


class TestUserInfo:
    """用户信息 API"""

    def test_user_me_after_register(self, client, test_user):
        r = client.get("/api/user/me", headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 0
        info = data["data"]
        assert info["username"] == test_user["username"]
        assert info["tier"] == "none"  # 刚注册，无套餐
        assert info["security_question"] == "你的宠物名字？"
        assert "codes" in info

    def test_user_me_no_token(self, client):
        r = client.get("/api/user/me")
        assert r.status_code == 200
        assert r.json()["code"] == 1
        assert "未登录" in r.json()["msg"]

    def test_user_me_invalid_token(self, client):
        r = client.get("/api/user/me", headers={"Authorization": "Bearer invalid_token_xxx"})
        assert r.status_code == 200
        assert r.json()["code"] == 1


class TestLicenseActivate:
    """激活码完整流程"""

    def test_activate_flow(self, client, test_user, admin_token):
        # 1. 生成激活码
        r = client.post("/api/generate_code", json={
            "admin_token": admin_token,
            "tier": "yearly",
            "count": 1,
        })
        assert r.status_code == 200
        gen = r.json()
        assert gen["code"] == 0
        code = gen["data"]["codes"][0]
        assert code.startswith("AC-")

        # 2. 激活前套餐是 none
        r = client.get("/api/user/me", headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.json()["data"]["tier"] == "none"

        # 3. 激活
        r = client.post("/api/license/activate", json={"code": code},
                         headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        act = r.json()
        assert act["code"] == 0
        assert "new_expires_at" in act["data"]

        # 4. 激活后套餐更新
        r = client.get("/api/user/me", headers={"Authorization": f"Bearer {test_user['token']}"})
        info = r.json()["data"]
        assert info["tier"] == "yearly"
        assert info["expires_at"] != ""
        assert len(info["codes"]) == 1
        assert info["codes"][0]["code_id"] == code

    def test_activate_invalid_code(self, client, test_user):
        r = client.post("/api/license/activate", json={"code": "AC-INVALID-CODE-XXXX"},
                         headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        assert r.json()["code"] == 1
        assert "无效" in r.json()["msg"]

    def test_activate_no_auth(self, client):
        r = client.post("/api/license/activate", json={"code": "AC-TEST-XXXX-XXXX"})
        assert r.status_code == 200
        assert r.json()["code"] == 1


class TestPasswordAndSecurity:
    """密码和密保修改"""

    def test_change_password(self, client, test_user):
        new_pwd = "NewPass456!"
        r = client.put("/api/user/password", json={
            "old_password": test_user["password"],
            "new_password": new_pwd,
        }, headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        assert r.json()["code"] == 0

        # 用新密码登录验证
        r = client.post("/api/web/login", json={
            "username": test_user["username"],
            "password": new_pwd,
        })
        assert r.status_code == 200
        assert r.json()["code"] == 0

    def test_change_password_wrong_old(self, client, test_user):
        r = client.put("/api/user/password", json={
            "old_password": "wrong_old_pwd",
            "new_password": "Anything123!",
        }, headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        assert r.json()["code"] == 1
        assert "旧密码错误" in r.json()["msg"]

    def test_change_security(self, client, test_user):
        r = client.put("/api/user/security", json={
            "security_question": "新问题？",
            "security_answer": "新答案",
        }, headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        assert r.json()["code"] == 0

        # 验证已更新
        r = client.get("/api/user/me", headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.json()["data"]["security_question"] == "新问题？"


class TestDevices:
    """设备管理"""

    def test_device_list_empty(self, client, test_user):
        r = client.get("/api/device/my", headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 0
        assert isinstance(data["data"], list)

    def test_device_remove_no_auth(self, client):
        r = client.post("/api/device/remove", json={"pc_hash": "test_hash"})
        assert r.status_code == 200
        assert r.json()["code"] == 1


class TestFullFlow:
    """完整用户旅程"""

    def test_complete_user_journey(self, client, admin_token):
        """注册 → 登录 → 看信息 → 激活码 → 改密码 → 验证"""
        # 注册
        ts = date.today().strftime("%m%d%H%M%S")
        username = f"journey_{ts}"
        r = client.post("/api/web/register", json={
            "username": username, "password": "Start123!",
            "security_question": "q?", "security_answer": "a",
        })
        assert r.json()["code"] == 0
        token = r.json()["data"]["token"]

        # 查信息（无套餐）
        r = client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"})
        assert r.json()["data"]["tier"] == "none"

        # 生成并激活码
        r = client.post("/api/generate_code", json={"admin_token": admin_token, "tier": "quarterly", "count": 1})
        code = r.json()["data"]["codes"][0]
        r = client.post("/api/license/activate", json={"code": code},
                         headers={"Authorization": f"Bearer {token}"})
        assert r.json()["code"] == 0

        # 验证套餐
        r = client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"})
        assert r.json()["data"]["tier"] == "quarterly"

        # 改密码
        r = client.put("/api/user/password", json={"old_password": "Start123!", "new_password": "NewPass789!"},
                        headers={"Authorization": f"Bearer {token}"})
        assert r.json()["code"] == 0

        # 用新密码登录
        r = client.post("/api/web/login", json={"username": username, "password": "NewPass789!"})
        assert r.json()["code"] == 0

        # 设备列表
        r = client.get("/api/device/my", headers={"Authorization": f"Bearer {r.json()['data']['token']}"})
        assert r.json()["code"] == 0
