"""Tests for AI settings generation endpoints."""

import httpx
import pytest

BASE_URL = "http://localhost/api"

# ---------------------------------------------------------------------------
# Helper: unique test user
# ---------------------------------------------------------------------------

def random_user():
    import random
    n = random.randint(10000, 99999)
    return {
        "email": f"ai_test_{n}@example.com",
        "password": "TestPass123!",
        "display_name": f"AITest_{n}",
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
# AI Settings — Auth & Validation
# =========================================================================

class TestSettingsAIValidation:
    """Test auth/validation without real AI calls."""

    def test_generate_no_auth(self):
        """No auth token should return 401/403."""
        resp = httpx.post(
            f"{BASE_URL}/projects/fake-id/settings/generate",
            json={"types": ["world"]},
        )
        assert resp.status_code in (401, 403)

    def test_generate_invalid_project(self):
        """Non-existent project should fail."""
        resp = httpx.post(
            f"{BASE_URL}/projects/nonexistent/settings/generate",
            json={"types": ["world"]},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert resp.status_code in (401, 403, 404)

    def test_field_generate_no_auth(self):
        """No auth token on field generation should return 401/403."""
        resp = httpx.post(
            f"{BASE_URL}/projects/fake-id/settings/ai/world/scenes",
            json={"context": {}},
        )
        assert resp.status_code in (401, 403)

    def test_field_generate_invalid_type(self):
        """anti-ai type should be rejected for per-field generation."""
        token, user = register_user()

        # Create a project
        import random
        n = random.randint(10000, 99999)
        r2 = httpx.post(
            f"{BASE_URL}/projects",
            json={"name": f"AIProject_{n}"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r2.status_code in (200, 201)
        pid = r2.json()["id"]

        # Try to generate field for anti-ai type (should be rejected)
        resp = httpx.post(
            f"{BASE_URL}/projects/{pid}/settings/ai/anti-ai/some-field",
            json={"context": {}},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "not supported" in str(data.get("detail", "")).lower()
