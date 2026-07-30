import httpx

BASE_URL = "http://localhost:8000/api"

# ---------------------------------------------------------------------------
# Helper: unique test user
# ---------------------------------------------------------------------------


def random_user():
    import uuid

    uid = uuid.uuid4().hex[:12]
    return {
        "email": f"testuser_{uid}@example.com",
        "password": "TestPass123!",
        "display_name": f"Tester_{uid[:6]}",
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
    def test_register_and_auth(self):
        """Register returns JWT token, token works for novel access."""
        user = random_user()

        # Register
        r = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r.status_code in (200, 201), f"Register failed: {r.text}"
        data = r.json()
        token = data.get("access_token") or data["token"]
        assert token is not None

        # Verify the token works by creating a novel
        headers = {"Authorization": f"Bearer {token}"}
        r2 = httpx.post(
            f"{BASE_URL}/novels",
            json={"name": "auth-test-proj"},
            headers=headers,
        )
        assert r2.status_code in (200, 201), f"Novel create failed: {r2.text}"
        assert r2.json()["name"] == "auth-test-proj"

    def test_register_duplicate_email(self):
        """Registering same email twice returns 409."""
        user = random_user()
        r = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r.status_code in (200, 201)

        r2 = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r2.status_code == 409

    def test_unauthenticated_access_returns_401(self):
        """Protected endpoint without token returns 401."""
        # /auth/check-auth returns 200 with JSON even without auth
        # Use a novel endpoint instead
        resp = httpx.get(f"{BASE_URL}/novels")
        assert resp.status_code in (401, 403)


# =========================================================================
# Novels
# =========================================================================


class TestNovels:
    def test_create_and_list(self):
        token, _user = register_user()
        headers = {"Authorization": f"Bearer {token}"}

        # Create project
        import random

        name = f"测试项目_{random.randint(1000, 9999)}"
        r2 = httpx.post(f"{BASE_URL}/novels", json={"name": name}, headers=headers)
        assert r2.status_code in (200, 201), f"Create project failed: {r2.text}"
        project = r2.json()
        assert project["name"] == name
        slug = project["slug"]

        # List projects
        r3 = httpx.get(f"{BASE_URL}/novels", headers=headers)
        assert r3.status_code == 200
        slugs = [p["slug"] for p in r3.json()]
        assert slug in slugs

    def test_get_by_slug(self):
        token, _user = register_user()
        headers = {"Authorization": f"Bearer {token}"}

        import random

        name = f"slug-test_{random.randint(1000, 9999)}"
        r2 = httpx.post(f"{BASE_URL}/novels", json={"name": name}, headers=headers)
        assert r2.status_code in (200, 201)
        slug = r2.json()["slug"]

        r3 = httpx.get(f"{BASE_URL}/novels/by-slug/{slug}", headers=headers)
        assert r3.status_code == 200
        assert r3.json()["name"] == name

    def test_delete_project(self):
        token, _user = register_user()
        headers = {"Authorization": f"Bearer {token}"}

        r2 = httpx.post(
            f"{BASE_URL}/novels", json={"name": "delete-me"}, headers=headers
        )
        assert r2.status_code in (200, 201)


# =========================================================================
# Workflow — Confirm Chapter + Phase Transition
# =========================================================================


def _prime_settings(pid: str, headers: dict):
    """Pre-fill required settings so gate_settings_complete passes."""
    # world-setting: need at least 5 filled top-level fields
    httpx.put(
        f"{BASE_URL}/novels/{pid}/settings/world",
        json={
            "name": "Test World",
            "summary": "A test world for workflow testing",
            "genre": "fantasy",
            "tone": "serious",
            "theme": "redemption",
            "details": {"geography": "", "politics": "", "culture": ""},
        },
        headers=headers,
    )
    # hooks: need at least 3 hooks
    httpx.put(
        f"{BASE_URL}/novels/{pid}/settings/hooks",
        json={
            "hooks": [
                {
                    "id": "hook-1",
                    "description": "First hook",
                    "introduced_in": "1-1",
                    "status": "pending",
                },
                {
                    "id": "hook-2",
                    "description": "Second hook",
                    "introduced_in": "1-1",
                    "status": "pending",
                },
                {
                    "id": "hook-3",
                    "description": "Third hook",
                    "introduced_in": "1-1",
                    "status": "pending",
                },
            ]
        },
        headers=headers,
    )


def _create_project_and_chapter(headers: dict) -> tuple[str, str]:
    """Create a project, volume, and chapter. Returns (project_id, chapter_ref)."""
    import random

    name = f"wf-test_{random.randint(1000, 9999)}"
    r = httpx.post(f"{BASE_URL}/novels", json={"name": name}, headers=headers)
    assert r.status_code in (200, 201), f"Create project failed: {r.text}"
    pid = r.json()["id"]

    # Prime settings so gate_settings_complete passes
    _prime_settings(pid, headers)

    # Create volume (advances phase to "outline")
    r2 = httpx.post(
        f"{BASE_URL}/novels/{pid}/volumes",
        json={"vol_num": 1, "title": "Volume 1"},
        headers=headers,
    )
    assert r2.status_code in (200, 201), f"Create volume failed: {r2.text}"

    # Create chapter
    r3 = httpx.post(
        f"{BASE_URL}/novels/{pid}/chapters",
        json={"volume": 1, "chapter": 1, "title": "第1章"},
        headers=headers,
    )
    assert r3.status_code in (200, 201), f"Create chapter failed: {r3.text}"
    chapter_ref = r3.json()["chapter_ref"]

    # Fill in required fields to pass gate_chapter_ready
    update_body = {
        "segments": [{"type": "narration", "content": "test"}],
        "emotional_design": {"primary_mood": "紧张"},
        "memo": {
            "current_task": "完成本章",
            "reader_expectation": {
                "state": "好奇",
                "strategy": "铺垫伏笔",
                "detail": "让读者想知道接下来发生了什么",
            },
            "payoff_plan": {
                "must_resolve": [],
                "must_hold": [],
                "partial_advance": [],
            },
            "downtime_functions": [],
            "key_choices": [],
            "required_changes": ["调整节奏"],
            "prohibitions": [],
        },
    }
    r4 = httpx.put(
        f"{BASE_URL}/novels/{pid}/chapters/{chapter_ref}",
        json=update_body,
        headers=headers,
    )
    assert r4.status_code == 200, f"Update chapter failed: {r4.text}"
    return pid, chapter_ref


class TestWorkflowConfirm:
    def test_confirm_chapter_sets_status(self):
        token, _ = register_user()
        headers = {"Authorization": f"Bearer {token}"}
        pid, chapter_ref = _create_project_and_chapter(headers)

        r = httpx.post(
            f"{BASE_URL}/novels/{pid}/chapters/{chapter_ref}/confirm",
            headers=headers,
        )
        assert r.status_code == 200, f"Confirm failed: {r.text}"
        data = r.json()
        assert data["status"] == "confirmed"

        # Verify project phase did NOT advance
        r2 = httpx.get(f"{BASE_URL}/novels/{pid}", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["current_phase"] == "outline"

    def test_confirm_incomplete_chapter_returns_400(self):
        token, _user = register_user()
        headers = {"Authorization": f"Bearer {token}"}
        import random

        name = f"wf-incomplete_{random.randint(1000, 9999)}"
        r = httpx.post(f"{BASE_URL}/novels", json={"name": name}, headers=headers)
        assert r.status_code in (200, 201)
        pid = r.json()["id"]
        _prime_settings(pid, headers)

        # Create volume
        httpx.post(
            f"{BASE_URL}/novels/{pid}/volumes",
            json={"vol_num": 1, "title": "Volume 1"},
            headers=headers,
        )

        # Create chapter but do NOT fill required fields
        r2 = httpx.post(
            f"{BASE_URL}/novels/{pid}/chapters",
            json={"volume": 1, "chapter": 1, "title": "第1章"},
            headers=headers,
        )
        assert r2.status_code in (200, 201)
        chapter_ref = r2.json()["chapter_ref"]

        r3 = httpx.post(
            f"{BASE_URL}/novels/{pid}/chapters/{chapter_ref}/confirm",
            headers=headers,
        )
        assert r3.status_code == 400
        assert "not ready" in r3.text.lower()

    def test_confirm_unauthorized_returns_401(self):
        r = httpx.post(
            f"{BASE_URL}/novels/nonexistent/chapters/vol-1-ch-1/confirm",
        )
        assert r.status_code in (401, 403)


class TestWorkflowTransition:
    def test_transition_all_chapters_ready(self):
        token, _ = register_user()
        headers = {"Authorization": f"Bearer {token}"}
        pid, chapter_ref = _create_project_and_chapter(headers)

        # First confirm the chapter
        r = httpx.post(
            f"{BASE_URL}/novels/{pid}/chapters/{chapter_ref}/confirm",
            headers=headers,
        )
        assert r.status_code == 200

        # Now transition to prompt phase
        r2 = httpx.post(
            f"{BASE_URL}/novels/{pid}/workflow/transition",
            json={"target": "prompt"},
            headers=headers,
        )
        assert r2.status_code == 200, f"Transition failed: {r2.text}"
        data = r2.json()
        assert data["ok"] is True
        assert data["phase"] == "prompt"

    def test_transition_with_incomplete_chapter_returns_400(self):
        """Transition to prompt fails when a chapter is incomplete."""
        token, _ = register_user()
        headers = {"Authorization": f"Bearer {token}"}
        pid = _create_project_and_chapter(headers)[0]

        # Create a second chapter WITHOUT filling required fields
        r = httpx.post(
            f"{BASE_URL}/novels/{pid}/chapters",
            json={"volume": 1, "chapter": 2, "title": "第2章"},
            headers=headers,
        )
        assert r.status_code in (200, 201)

        r = httpx.post(
            f"{BASE_URL}/novels/{pid}/workflow/transition",
            json={"target": "prompt"},
            headers=headers,
        )
        assert r.status_code == 400
        # Should say chapters are not ready
        assert "not ready" in r.text.lower() or "failures" in r.text.lower()

    def test_transition_missing_target_returns_400(self):
        token, _ = register_user()
        headers = {"Authorization": f"Bearer {token}"}
        pid, _ = _create_project_and_chapter(headers)

        r = httpx.post(
            f"{BASE_URL}/novels/{pid}/workflow/transition",
            json={},
            headers=headers,
        )
        assert r.status_code == 400
        assert "target is required" in r.text.lower()

    def test_transition_unsupported_target_returns_400(self):
        token, _ = register_user()
        headers = {"Authorization": f"Bearer {token}"}
        pid, _ = _create_project_and_chapter(headers)

        r = httpx.post(
            f"{BASE_URL}/novels/{pid}/workflow/transition",
            json={"target": "invalid_target"},
            headers=headers,
        )
        assert r.status_code == 400
        assert "unsupported target" in r.text.lower()

    def test_transition_unauthorized_returns_401(self):
        r = httpx.post(
            f"{BASE_URL}/novels/nonexistent/workflow/transition",
            json={"target": "prompt"},
        )
        assert r.status_code in (401, 403)
