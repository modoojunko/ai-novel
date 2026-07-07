"""Tests for admin RBAC system."""

import httpx
import pytest

BASE_URL = "http://localhost/api"


def _random_user():
    import random
    n = random.randint(10000, 99999)
    return {
        "email": f"admin_test_{n}@example.com",
        "password": "TestPass123!",
        "display_name": f"Tester_{n}",
    }


class TestAdminAccess:
    """Test admin middleware and endpoints."""

    def test_admin_stats_no_auth(self):
        """Admin endpoint without token returns 401/403."""
        resp = httpx.get(f"{BASE_URL}/admin/stats")
        assert resp.status_code in (401, 403)

    def test_admin_stats_regular_user(self):
        """Regular user trying to access admin gets 403."""
        user = _random_user()
        r = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r.status_code in (200, 201)
        token = r.json().get("access_token") or r.json()["token"]

        resp = httpx.get(f"{BASE_URL}/admin/stats", headers={"Authorization": f"Bearer {token}"})
        # Regular user should get 403, not 200
        assert resp.status_code == 403
        data = resp.json()
        assert "管理员" in str(data.get("detail", ""))

    def test_admin_users_list(self):
        """Admin endpoints require admin role — regular user gets 403."""
        user = _random_user()
        r = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r.status_code in (200, 201)
        token = r.json().get("access_token") or r.json()["token"]

        resp = httpx.get(f"{BASE_URL}/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_admin_plan_change(self):
        """Plan change endpoint requires admin."""
        user = _random_user()
        r = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r.status_code in (200, 201)
        token = r.json().get("access_token") or r.json()["token"]
        uid = r.json()["user"]["id"]

        resp = httpx.put(
            f"{BASE_URL}/admin/users/{uid}/plan",
            json={"subscription_type": "monthly"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_admin_topup(self):
        """Topup endpoint requires admin."""
        user = _random_user()
        r = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r.status_code in (200, 201)
        token = r.json().get("access_token") or r.json()["token"]
        uid = r.json()["user"]["id"]

        resp = httpx.post(
            f"{BASE_URL}/admin/users/{uid}/topup",
            json={"amount": 10000},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_projects_list_admin_only(self):
        """Project listing requires admin."""
        user = _random_user()
        r = httpx.post(f"{BASE_URL}/auth/register", json=user)
        assert r.status_code in (200, 201)
        token = r.json().get("access_token") or r.json()["token"]

        resp = httpx.get(f"{BASE_URL}/admin/projects", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403
