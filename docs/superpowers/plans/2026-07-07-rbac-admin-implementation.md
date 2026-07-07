# RBAC + Admin Backend — Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement.

**Goal:** Add role-based access control (admin/user), user activation status (active/inactive), and admin management backend.

**Architecture:** Extend users table with role/status fields. Add admin middleware. Add admin API router. Build admin frontend as a separate route group under /admin.

**Tech Stack:** Python/FastAPI + SQLAlchemy (backend), React 19 + daisyUI (frontend)

---

## File Structure

### Backend — Create

| File | Purpose |
|------|---------|
| `backend/admin/__init__.py` | Package init |
| `backend/admin/middleware.py` | require_admin + check_active dependencies |
| `backend/admin/service.py` | User/plan management logic |
| `backend/admin/router.py` | Admin API routes |

### Backend — Modify

| File | Change |
|------|--------|
| `backend/models/user.py` | Add role, status, subscription fields |
| `backend/config.py` | Add ADMIN_EMAILS config |
| `backend/auth/middleware.py` | Extend get_current_user to return role/status |
| `backend/main.py` | Register admin router |

### Frontend — Create

| File | Purpose |
|------|---------|
| `frontend/src/pages/admin/AdminLayout.tsx` | Admin layout with sidebar |
| `frontend/src/pages/admin/DashboardPage.tsx` | Stats dashboard |
| `frontend/src/pages/admin/UsersPage.tsx` | User list |
| `frontend/src/pages/admin/UserDetailPage.tsx` | User detail + plan management |
| `frontend/src/pages/admin/ProjectsPage.tsx` | Project browser (read-only) |
| `frontend/src/pages/admin/TokenLogsPage.tsx` | Token consumption logs |

### Frontend — Modify

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add /admin routes |
| `frontend/src/components/Navbar.tsx` | Add admin link for admin users |
| `frontend/src/lib/api.ts` | Add 403 inactive user handling |

---

### Task 1: Extend User model

**Files:**
- Modify: `backend/models/user.py`
- Modify: `backend/config.py`

Add fields to User model and ADMIN_EMAILS config.

- [ ] **Commit:** `git add backend/models/user.py backend/config.py && git commit -m "feat: add role/status/subscription fields to user model"`

### Task 2: Admin middleware + check_active

**Files:**
- Create: `backend/admin/__init__.py`
- Create: `backend/admin/middleware.py`

Implement `require_admin()` and `check_active()` FastAPI dependencies.

- [ ] **Commit:** `git add backend/admin/ && git commit -m "feat: add admin and active-status middleware"`

### Task 3: Admin API routes

**Files:**
- Create: `backend/admin/service.py`
- Create: `backend/admin/router.py`
- Modify: `backend/main.py`

Implement user management, project listing, token log, stats endpoints.

- [ ] **Commit:** `git add backend/admin/ backend/main.py && git commit -m "feat: add admin management API"`

### Task 4: Frontend admin pages

**Files:**
- Create: `frontend/src/pages/admin/AdminLayout.tsx`
- Create: `frontend/src/pages/admin/DashboardPage.tsx`
- Create: `frontend/src/pages/admin/UsersPage.tsx`
- Create: `frontend/src/pages/admin/UserDetailPage.tsx`
- Create: `frontend/src/pages/admin/ProjectsPage.tsx`
- Create: `frontend/src/pages/admin/TokenLogsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Navbar.tsx`

Build admin SPA pages with daisyUI. Use frontend-design skill for UI layout.

- [ ] **Commit:** `git add frontend/src/pages/admin/ frontend/src/App.tsx frontend/src/components/Navbar.tsx && git commit -m "feat: add admin management frontend"`

### Task 5: Inactive user handling

**Files:**
- Modify: `frontend/src/lib/api.ts`

Add 403 response handling to redirect inactive users to a subscription page.

- [ ] **Commit:** `git add frontend/src/lib/api.ts && git commit -m "feat: handle inactive user 403 responses"`

### Task 6: Tests

**Files:**
- Create: `backend/tests/test_admin.py`

Test admin middleware, user status checks, API endpoints.

- [ ] **Commit:** `git add backend/tests/test_admin.py && git commit -m "test: add admin RBAC tests"`

### Task 7: Docker rebuild + verify

```bash
cd d:/code/ai-novel && docker compose up -d --build
cd backend && python -m pytest tests/ -v
cd frontend && npx playwright test
```
