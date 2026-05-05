# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NovelForge — multi-user web platform for AI-assisted long-form novel writing. 6-phase workflow (init → settings → outline → prompt → write → archive), token-based billing.

## Commands

```bash
# Start all services
docker compose up -d

# Backend only (for API dev)
docker compose up -d postgres && cd backend && uvicorn main:app --reload --port 8000

# Frontend only (for UI dev)
cd frontend && npm run dev

# Run a single backend test
cd backend && python -m pytest tests/ -k "test_name"

# Type-check frontend
cd frontend && npx tsc --noEmit

# Lint frontend
cd frontend && npm run lint
```

## Architecture

```
Nginx (:80) → /api/* → FastAPI (uvicorn, :8000) → PostgreSQL + filesystem
            → /*     → Next.js 14 (:3000)
```

Single Docker Compose host. SSE for streaming prose generation. No Redis, no task queue.

## Backend structure

```
backend/
  main.py              — FastAPI app, lifespan (auto-create tables), router wiring
  config.py            — env vars: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, DATA_ROOT
  db.py                — async SQLAlchemy engine + session factory + Base
  models/              — SQLAlchemy ORM: User, Project, TokenLog
  auth/                — JWT register/login/me + Bearer middleware
  projects/            — project CRUD + filesystem skeleton init
  settings/            — read/write YAML settings (world/style/anti-ai/hooks/characters)
  chapters/            — volume + chapter CRUD with gate confirmation
  workflow/            — phase state machine + gate validation functions
  prompt/              — assembler (perspective conversion, context injection, prompt generation)
  write/               — SSE streaming per segment + 6 quality checks
  archive/             — finalize prose to archives/, update threads + characters + hooks
  billing/             — token usage logging + usage summary API
  filesystem/          — YAML/MD reader/writer + project skeleton init (copies from reference/)
```

All routers follow the same pattern: `router = APIRouter(prefix=...)`, endpoints use `Depends(get_current_user)` + `Depends(get_db)`, and cross-check project ownership.

## Frontend structure

```
frontend/src/
  app/
    page.tsx              — landing page
    login/page.tsx        — sign in
    register/page.tsx     — sign up
    dashboard/page.tsx    — project list + create
    project/[slug]/
      layout.tsx          — AuthGuard + ProjectNav
      page.tsx            — redirect to /settings
      settings/           — world, style, anti-ai, hooks, characters (list + editor)
      outline/            — volumes + chapter tree
      prompts/            — prompt viewer (list + content)
      write/              — writing studio (SSE streaming + quality checks)
      archives/           — archive reader
      threads/            — thread timeline
  lib/
    api.ts                — fetch wrapper with JWT injection + 401 redirect
    auth.ts               — login/register/logout helpers, localStorage token
  components/
    auth/AuthGuard.tsx    — redirect to /login if no token
    project/ProjectNav.tsx — phase-based tab navigation
    settings/SettingsForm.tsx — generic YAML-as-JSON form
    ui/                   — shadcn/ui primitives (button, card, input, dialog, tabs, etc.)
```

Pages use `"use client"`, fetch from `/api/...`, manage state with `useState`/`useEffect`. No global state management library.

## Key conventions

- **Novel data on filesystem**: YAML/MD files at `/data/projects/{user_id}/{project_slug}/`. PostgreSQL only stores user, project, and billing metadata.
- **Phase gates before transitions**: Functions in `backend/workflow/gates.py` validate prerequisites. Gate fails → 400 with list of missing items.
- **Project ownership**: All API endpoints extract user_id from JWT, cross-check `project.user_id` before any file or DB operation.
- **Template files**: `reference/` holds `.template` files. `backend/filesystem/init.py` copies them when creating a new project skeleton.
- **Token accounting**: TokenLog rows are created per AI call. User balance deducted accordingly. `billing/service.py` has model-specific rates.

## Current state

Backend is complete (all router modules wired, token tracking active across all 3 AI call sites). Frontend has all pages built including Writing Studio with SSE streaming, archives reader, threads timeline, and settings forms. Rate limiting middleware active. No tests written yet.
