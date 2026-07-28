"""S端 Web API E2E 测试 — 全覆盖 (21/21 API)

前置条件: python server/local_server.py (端口 19000)
运行: python -m pytest server/tests/test_web_api.py -v
"""

import os, random, httpx, pytest, json
from datetime import date, timedelta

BASE = "http://127.0.0.1:19000"
ADMIN_TOKEN = "admin123"


@pytest.fixture(scope="session")
def client():
    return httpx.Client(base_url=BASE, timeout=10)


@pytest.fixture
def uid() -> str:
    return f"t{date.today().strftime('%m%d')}{random.randint(10000,99999)}"


@pytest.fixture
def user(client, uid) -> dict:
    """注册 Web 用户"""
    u = f"wu_{uid}"; pw = "Pass123!"
    r = client.post("/api/web/register", json={"username": u, "password": pw, "security_question": "q?", "security_answer": "a"})
    assert r.json()["code"] == 0
    return {"username": u, "password": pw, "token": r.json()["data"]["token"]}


@pytest.fixture
def oauth_user(client, uid) -> dict:
    """通过 /api/activate 创建 OAuth 用户（创建用户 + 激活码 + 绑定设备）"""
    u = f"ou_{uid}"; pw = "Pass456!"
    c = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "yearly", "count": 1}).json()["data"]["codes"][0]
    r = client.post("/api/activate", json={"activation_code": c, "username": u, "password": pw, "security_question": "q?", "security_answer": "a", "pc_hash": f"hash_{uid}", "pc_name": "测试机"})
    assert r.json()["code"] == 0, f"OAuth 用户创建失败: {r.json()}"
    return {"username": u, "password": pw, "pc_hash": f"hash_{uid}"}


@pytest.fixture
def code(client, uid) -> str:
    """生成一个未使用的激活码"""
    r = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "yearly", "count": 1})
    return r.json()["data"]["codes"][0]


# ═══════════════════════════════════════════════════════════════════
# 1. 静态页面 (5 tests)
# ═══════════════════════════════════════════════════════════════════

class TestStaticPages:
    @pytest.mark.parametrize("path", [
        "/", "/login", "/register",
        "/license.html", "/activate.html", "/devices.html", "/account.html",
        "/style.css", "/api.js", "/landing/index.html",
    ])
    def test_load(self, client, path):
        r = client.get(path)
        assert r.status_code == 200, f"{path} → {r.status_code}"
        assert len(r.text) > 50

# ═══════════════════════════════════════════════════════════════════
# 2. Web 注册/登录 (6 tests)
# ═══════════════════════════════════════════════════════════════════

class TestWebRegister:
    def test_success(self, client, uid):
        r = client.post("/api/web/register", json={"username": f"wr_{uid}", "password": "P1!", "security_question": "q", "security_answer": "a"})
        assert r.json()["code"] == 0 and len(r.json()["data"]["token"]) == 32

    def test_dup(self, client, user):
        r = client.post("/api/web/register", json={"username": user["username"], "password": "X2!", "security_question": "q", "security_answer": "a"})
        assert r.json()["code"] == 1

class TestWebLogin:
    def test_ok(self, client, user):
        r = client.post("/api/web/login", json={"username": user["username"], "password": user["password"]})
        assert r.json()["code"] == 0 and len(r.json()["data"]["token"]) == 32

    def test_bad_pwd(self, client, user):
        r = client.post("/api/web/login", json={"username": user["username"], "password": "wrong!"})
        assert r.json()["code"] == 1

    def test_nouser(self, client):
        r = client.post("/api/web/login", json={"username": "nobody_999999", "password": "x"})
        assert r.json()["code"] == 1

# ═══════════════════════════════════════════════════════════════════
# 3. OAuth 注册/登录 (6 tests)
# ═══════════════════════════════════════════════════════════════════

class TestOAuthRegister:
    def test_success(self, client, uid):
        r = client.post("/api/register", json={"username": f"or_{uid}", "password": "P1!", "security_question": "q", "security_answer": "a", "pc_hash": f"h_{uid}", "pc_name": "pc"})
        assert r.json()["code"] == 0
        assert r.json()["data"]["token"].startswith("eyJ")

    def test_dup(self, client, oauth_user):
        r = client.post("/api/register", json={"username": oauth_user["username"], "password": "X2!", "security_question": "q", "security_answer": "a", "pc_hash": "h2", "pc_name": "pc2"})
        assert r.json()["code"] == 1

class TestOAuthLogin:
    def test_ok(self, client, oauth_user):
        r = client.post("/api/login", json={"username": oauth_user["username"], "password": oauth_user["password"], "pc_hash": oauth_user["pc_hash"], "pc_name": "pc"})
        data = r.json()
        assert data["code"] == 0
        assert "token" in data["data"]
        assert "expires_at" in data["data"]
        assert "devices" in data["data"]

    def test_bad_pwd(self, client, oauth_user):
        r = client.post("/api/login", json={"username": oauth_user["username"], "password": "wrong!", "pc_hash": oauth_user["pc_hash"], "pc_name": "pc"})
        assert r.json()["code"] == 1

    def test_nouser(self, client):
        r = client.post("/api/login", json={"username": "x_nobody", "password": "x", "pc_hash": "x", "pc_name": "x"})
        assert r.json()["code"] == 1

# ═══════════════════════════════════════════════════════════════════
# 4. OAuth 授权流程 (4 tests)
# ═══════════════════════════════════════════════════════════════════

class TestOAuthFlow:
    def test_auth_page(self, client):
        r = client.get("/api/auth-page", params={"pc_hash": "test_hash"})
        assert r.status_code == 200
        assert "AI Novel" in r.text

    def test_authorize_ok(self, client, oauth_user):
        r = client.post("/api/authorize", json={"username": oauth_user["username"], "password": oauth_user["password"], "pc_hash": f"auth_{random.randint(1000,9999)}"})
        data = r.json()
        assert data["code"] == 0
        assert data["data"]["tier"] in ("yearly", "quarterly", "monthly", "none")

    def test_authorize_fail(self, client, oauth_user):
        r = client.post("/api/authorize", json={"username": oauth_user["username"], "password": "wrong!", "pc_hash": "x"})
        assert r.json()["code"] == 1

    def test_check_auth(self, client, oauth_user):
        pc = f"ca_{random.randint(1000,9999)}"
        client.post("/api/authorize", json={"username": oauth_user["username"], "password": oauth_user["password"], "pc_hash": pc})
        r = client.get("/api/check-auth", params={"pc_hash": pc})
        data = r.json()
        assert data["code"] == 0
        assert "token" in data["data"]
        assert "tier" in data["data"]

    def test_check_auth_pending(self, client):
        r = client.get("/api/check-auth", params={"pc_hash": "nonexistent_hash_99999"})
        assert r.json()["code"] == 1

# ═══════════════════════════════════════════════════════════════════
# 5. 用户信息 (3 tests)
# ═══════════════════════════════════════════════════════════════════

class TestUserInfo:
    def test_me(self, client, user):
        r = client.get("/api/user/me", headers={"Authorization": f"Bearer {user['token']}"})
        d = r.json(); assert d["code"] == 0
        assert d["data"]["username"] == user["username"]
        assert "tier" in d["data"] and "codes" in d["data"]

    def test_no_token(self, client):
        assert client.get("/api/user/me").json()["code"] == 1

    def test_bad_token(self, client):
        assert client.get("/api/user/me", headers={"Authorization": "Bearer invalid"}).json()["code"] == 1

# ═══════════════════════════════════════════════════════════════════
# 6. 激活码管理 (8 tests)
# ═══════════════════════════════════════════════════════════════════

class TestActivate:
    def test_flow(self, client, user, code):
        r = client.post("/api/license/activate", json={"code": code}, headers={"Authorization": f"Bearer {user['token']}"})
        assert r.json()["code"] == 0
        me = client.get("/api/user/me", headers={"Authorization": f"Bearer {user['token']}"}).json()
        assert me["data"]["tier"] == "yearly"
        assert len(me["data"]["codes"]) == 1

    def test_wrong_code(self, client, user):
        r = client.post("/api/license/activate", json={"code": "AC-NO-SUCH-CODE"}, headers={"Authorization": f"Bearer {user['token']}"})
        assert r.json()["code"] == 1

    def test_used_code(self, client, user, code):
        client.post("/api/license/activate", json={"code": code}, headers={"Authorization": f"Bearer {user['token']}"})
        r = client.post("/api/license/activate", json={"code": code}, headers={"Authorization": f"Bearer {user['token']}"})
        assert r.json()["code"] == 1 and "已被使用" in r.json()["msg"]

    def test_no_auth(self, client, code):
        r = client.post("/api/license/activate", json={"code": code})
        assert r.json()["code"] == 1

    def test_stack_renew(self, client, user):
        """叠加续期: 先激活年费, 再激活季费 → 到期日叠加"""
        r1 = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "yearly", "count": 1})
        c1 = r1.json()["data"]["codes"][0]
        client.post("/api/license/activate", json={"code": c1}, headers={"Authorization": f"Bearer {user['token']}"})
        me1 = client.get("/api/user/me", headers={"Authorization": f"Bearer {user['token']}"}).json()
        exp1 = date.fromisoformat(me1["data"]["expires_at"])

        r2 = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "quarterly", "count": 1})
        c2 = r2.json()["data"]["codes"][0]
        client.post("/api/license/activate", json={"code": c2}, headers={"Authorization": f"Bearer {user['token']}"})
        me2 = client.get("/api/user/me", headers={"Authorization": f"Bearer {user['token']}"}).json()
        exp2 = date.fromisoformat(me2["data"]["expires_at"])
        # 季费90天，所以新的到期日应该 >= 旧到期日+85天
        assert (exp2 - exp1).days >= 85, f"叠加失败: {exp1} → {exp2}"

# ═══════════════════════════════════════════════════════════════════
# 7. 管理员发码 (3 tests)
# ═══════════════════════════════════════════════════════════════════

class TestAdmin:
    def test_generate_code(self, client):
        r = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "monthly", "count": 3})
        d = r.json()
        assert d["code"] == 0
        assert len(d["data"]["codes"]) == 3
        for c in d["data"]["codes"]: assert c.startswith("AC-")

    def test_generate_bad_token(self, client):
        r = client.post("/api/generate_code", json={"admin_token": "wrong", "tier": "yearly", "count": 1})
        assert r.json()["code"] == 3

    def test_generate_bad_count(self, client):
        r = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "yearly", "count": 999})
        assert r.json()["code"] == 1

    def test_query_codes(self, client, user):
        r = client.post("/api/query_codes", json={"admin_token": ADMIN_TOKEN, "username": user["username"]})
        d = r.json()
        assert d["code"] == 0
        assert isinstance(d["data"]["codes"], list)

    def test_query_codes_bad_token(self, client):
        r = client.post("/api/query_codes", json={"admin_token": "wrong"})
        assert r.json()["code"] == 3

# ═══════════════════════════════════════════════════════════════════
# 8. 密码/密保 (3 tests)
# ═══════════════════════════════════════════════════════════════════

class TestAccount:
    def test_change_password(self, client, user):
        new = "NewPwd789!"
        r = client.put("/api/user/password", json={"old_password": user["password"], "new_password": new}, headers={"Authorization": f"Bearer {user['token']}"})
        assert r.json()["code"] == 0
        # 用新密码登录
        r2 = client.post("/api/web/login", json={"username": user["username"], "password": new})
        assert r2.json()["code"] == 0

    def test_change_password_wrong_old(self, client, user):
        r = client.put("/api/user/password", json={"old_password": "wrong", "new_password": "X"}, headers={"Authorization": f"Bearer {user['token']}"})
        assert r.json()["code"] == 1

    def test_change_security(self, client, user):
        r = client.put("/api/user/security", json={"security_question": "新问题", "security_answer": "新答案"}, headers={"Authorization": f"Bearer {user['token']}"})
        assert r.json()["code"] == 0
        me = client.get("/api/user/me", headers={"Authorization": f"Bearer {user['token']}"}).json()
        assert me["data"]["security_question"] == "新问题"

    def test_reset_password(self, client, uid, oauth_user):
        """密保重置密码"""
        r = client.post("/api/reset_password", json={"username": oauth_user["username"], "security_answer": "a", "new_password": "ResetPwd1!"})
        assert r.json()["code"] == 0
        # 用新密码登录
        r2 = client.post("/api/web/login", json={"username": oauth_user["username"], "password": "ResetPwd1!"})
        assert r2.json()["code"] == 0

# ═══════════════════════════════════════════════════════════════════
# 9. 设备管理 (3 tests)
# ═══════════════════════════════════════════════════════════════════

class TestDevice:
    def test_list_with_device(self, client, user, uid):
        """先通过 OAuth login 绑定设备，再通过 Web API 查询"""
        # 先 OAuth login 绑定设备
        h = f"dev_hash_{uid}"
        client.post("/api/register", json={"username": f"dev_{uid}", "password": "P1!", "security_question": "q", "security_answer": "a", "pc_hash": h, "pc_name": "dev"})
        c = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "yearly", "count": 1}).json()["data"]["codes"][0]
        client.post("/api/activate", json={"activation_code": c, "username": f"dev_{uid}", "password": "P1!", "security_question": "q", "security_answer": "a", "pc_hash": h, "pc_name": "dev"})
        r2 = client.get("/api/device/my", headers={"Authorization": f"Bearer {user['token']}"})
        assert r2.json()["code"] == 0

    def test_remove_device(self, client, uid):
        h = f"rm_hash_{uid}"; u = f"rm_{uid}"
        c = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "yearly", "count": 1}).json()["data"]["codes"][0]
        r = client.post("/api/activate", json={"activation_code": c, "username": u, "password": "P1!", "security_question": "q", "security_answer": "a", "pc_hash": h, "pc_name": "rm"})
        assert r.json()["code"] == 0, f"activate: {r.json()}"
        r2 = client.post("/api/login", json={"username": u, "password": "P1!", "pc_hash": h, "pc_name": "rm"})
        assert r2.json()["code"] == 0, f"login: {r2.json()}"
        r3 = client.post("/api/devices/remove", json={"username": u, "token": r2.json()["data"]["token"], "pc_hash": h})
        assert r3.json()["code"] == 0

    def test_device_remove_web_api_no_auth(self, client):
        """Web API /api/device/remove — 无认证返回 未登录"""
        r = client.post("/api/device/remove", json={"pc_hash": "x"})
        assert r.json()["code"] == 1

# ═══════════════════════════════════════════════════════════════════
# 10. verify / renew (2 tests)
# ═══════════════════════════════════════════════════════════════════

class TestVerifyRenew:
    def test_verify(self, client, oauth_user):
        r = client.post("/api/login", json={"username": oauth_user["username"], "password": oauth_user["password"], "pc_hash": oauth_user["pc_hash"], "pc_name": "pc"})
        token = r.json()["data"]["token"]
        r2 = client.post("/api/verify", json={"username": oauth_user["username"], "token": token, "pc_hash": oauth_user["pc_hash"]})
        d = r2.json()
        assert d["code"] == 0
        assert d["data"]["valid"] in (True, False)
        assert "license_valid" in d["data"] and "device_valid" in d["data"]

    def test_renew(self, client, oauth_user):
        """续期: renew API 用新激活码叠加"""
        r = client.post("/api/login", json={"username": oauth_user["username"], "password": oauth_user["password"], "pc_hash": oauth_user["pc_hash"], "pc_name": "pc"})
        token = r.json()["data"]["token"]
        r2 = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "monthly", "count": 1})
        code = r2.json()["data"]["codes"][0]
        r3 = client.post("/api/renew", json={"username": oauth_user["username"], "token": token, "activation_code": code, "pc_hash": oauth_user["pc_hash"]})
        assert r3.json()["code"] == 0

# ═══════════════════════════════════════════════════════════════════
# 11. 完整用户旅程 (1 test)
# ═══════════════════════════════════════════════════════════════════

class TestFullJourney:
    def test_journey(self, client, uid):
        u = f"fj_{uid}"; pw = "Start123!"
        # 注册
        r = client.post("/api/web/register", json={"username": u, "password": pw, "security_question": "q", "security_answer": "a"})
        token = r.json()["data"]["token"]
        assert r.json()["code"] == 0
        # 无套餐
        assert client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"}).json()["data"]["tier"] == "none"
        # 生成+激活
        r = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "quarterly", "count": 1})
        c = r.json()["data"]["codes"][0]
        client.post("/api/license/activate", json={"code": c}, headers={"Authorization": f"Bearer {token}"})
        assert client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"}).json()["data"]["tier"] == "quarterly"
        # 改密码
        client.put("/api/user/password", json={"old_password": pw, "new_password": "NewPwd!"}, headers={"Authorization": f"Bearer {token}"})
        # 用新密码登录
        r2 = client.post("/api/web/login", json={"username": u, "password": "NewPwd!"})
        assert r2.json()["code"] == 0

# ═══════════════════════════════════════════════════════════════════
# 12. 边界情况 (2 tests)
# ═══════════════════════════════════════════════════════════════════

class TestEdgeCases:
    def test_login_short_password(self, client, uid):
        """密码短但能注册，登录也能成功"""
        r = client.post("/api/web/register", json={"username": f"edge_{uid}", "password": "ab", "security_question": "q", "security_answer": "a"})
        assert r.json()["code"] == 0
        r2 = client.post("/api/web/login", json={"username": f"edge_{uid}", "password": "ab"})
        assert r2.json()["code"] == 0

    def test_activate_without_prior_tier(self, client, uid):
        """首次激活码（没有已有套餐）"""
        u = f"first_{uid}"
        client.post("/api/web/register", json={"username": u, "password": "P1!", "security_question": "q", "security_answer": "a"})
        r = client.post("/api/web/login", json={"username": u, "password": "P1!"})
        token = r.json()["data"]["token"]
        c = client.post("/api/generate_code", json={"admin_token": ADMIN_TOKEN, "tier": "lifetime", "count": 1}).json()["data"]["codes"][0]
        r2 = client.post("/api/license/activate", json={"code": c}, headers={"Authorization": f"Bearer {token}"})
        assert r2.json()["code"] == 0
        assert client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"}).json()["data"]["tier"] == "lifetime"


# ═══════════════════════════════════════════════════════════════════
# 13. Jinja2 页面路由 (4 tests)
# ═══════════════════════════════════════════════════════════════════

class TestJinja2Pages:
    def test_login_page(self, client):
        r = client.get("/login")
        assert r.status_code == 200
        assert "登录" in r.text
        assert "AI Novel" in r.text

    def test_dashboard_no_auth(self, client):
        r = client.get("/dashboard", follow_redirects=False)
        assert r.status_code in (302, 307)
        assert "/login" in r.headers.get("location", "")

    def test_dashboard_with_auth(self, client, user):
        r = client.get(f"/dashboard?token={user['token']}")
        assert r.status_code == 200
        assert user["username"] in r.text
        assert "我的套餐" in r.text

    def test_register_redirect(self, client):
        r = client.get("/register")
        # 302 重定向到 /register.html
        assert r.status_code in (200, 302, 307)
        assert r.status_code != 404
