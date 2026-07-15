import httpx

BASE_URL = "http://localhost/api"

# ---------------------------------------------------------------------------
# Helper: unique test user
# ---------------------------------------------------------------------------

def random_user():
    import random
    n = random.randint(10000, 99999)
    return {
        "email": f"testuser_{n}@example.com",
        "password": "TestPass123!",
        "display_name": f"Tester_{n}",
    }


def register_user():
    """Register and return (token, user_dict)."""
    user = random_user()
    r = httpx.post(f"{BASE_URL}/auth/register", json=user)
    assert r.status_code in (200, 201), f"Register failed: {r.text}"
    data = r.json()
    token = data.get("access_token") or data["token"]
    return token, user


# =========================================================================
# Health
# =========================================================================

class TestHealth:
    def test_health_returns_ok(self):
        resp = httpx.get(f"{BASE_URL}/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


# =========================================================================
# Auth
# =========================================================================

class TestAuth:
    def test_register_and_login(self):
        user = random_user()

        # Register
        r = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r.status_code in (200, 201), f"Register failed: {r.text}"
        data = r.json()
        token = data.get("access_token") or data["token"]
        assert token is not None

        # Login with same credentials
        r2 = httpx.post(f"{BASE_URL}/auth/login", json={
            "email": user["email"],
            "password": user["password"],
        })
        assert r2.status_code == 200, f"Login failed: {r2.text}"
        token2 = r2.json().get("access_token") or r2.json()["token"]

        # Get /me
        r3 = httpx.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert r3.status_code == 200
        assert r3.json()["email"] == user["email"]

    def test_login_wrong_password(self):
        user = random_user()
        httpx.post(f"{BASE_URL}/auth/register", json=user)
        r = httpx.post(f"{BASE_URL}/auth/login", json={
            "email": user["email"],
            "password": "wrong-pass",
        })
        assert r.status_code == 401

    def test_me_without_token(self):
        r = httpx.get(f"{BASE_URL}/auth/me")
        # Backend returns 401 or 403 for unauthenticated — accept either
        assert r.status_code in (401, 403)


# =========================================================================
# Projects
# =========================================================================

class TestProjects:
    def test_create_and_list(self):
        token, user = register_user()
        headers = {"Authorization": f"Bearer {token}"}

        # Create project
        import random
        name = f"测试项目_{random.randint(1000,9999)}"
        r2 = httpx.post(f"{BASE_URL}/projects", json={"name": name}, headers=headers)
        assert r2.status_code in (200, 201), f"Create project failed: {r2.text}"
        project = r2.json()
        assert project["name"] == name
        slug = project["slug"]

        # List projects
        r3 = httpx.get(f"{BASE_URL}/projects", headers=headers)
        assert r3.status_code == 200
        slugs = [p["slug"] for p in r3.json()]
        assert slug in slugs

    def test_get_by_slug(self):
        token, user = register_user()
        headers = {"Authorization": f"Bearer {token}"}

        import random
        name = f"slug-test_{random.randint(1000,9999)}"
        r2 = httpx.post(f"{BASE_URL}/projects", json={"name": name}, headers=headers)
        assert r2.status_code in (200, 201)
        slug = r2.json()["slug"]

        r3 = httpx.get(f"{BASE_URL}/projects/by-slug/{slug}", headers=headers)
        assert r3.status_code == 200
        assert r3.json()["name"] == name

    def test_delete_project(self):
        token, user = register_user()
        headers = {"Authorization": f"Bearer {token}"}

        r2 = httpx.post(f"{BASE_URL}/projects", json={"name": "delete-me"}, headers=headers)
        assert r2.status_code in (200, 201)
        pid = r2.json()["id"]

        r3 = httpx.delete(f"{BASE_URL}/projects/{pid}", headers=headers)
        assert r3.status_code == 200, f"Delete failed: {r3.text}"
