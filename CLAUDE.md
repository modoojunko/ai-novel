# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NovelForge — multi-user web platform for AI-assisted long-form novel writing. Users register, create novel projects, and work through a 6-phase workflow (init → settings → outline → prompt → write → archive) with AI, billed by token usage.

## Architecture

```
Nginx (reverse proxy) → /api/* → FastAPI → PostgreSQL (user/project metadata) + filesystem (novel data)
                      → /*      → Next.js 14 (React + shadcn/ui)
```

Single Docker Compose host. No Redis, no Celery, no Kubernetes. SSE for streaming, asyncio throughout.

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, python-jose JWT, Anthropic SDK
- **Frontend**: Next.js 14 (App Router), TypeScript, shadcn/ui, Tailwind CSS
- **Database**: PostgreSQL 16 — only 4 tables: `users`, `projects`, `token_log`, `sessions`
- **Novel data**: YAML + Markdown files on disk at `/data/projects/{user_id}/{project_slug}/`
- **Deploy**: `docker-compose.yml` — nginx, backend (uvicorn 4 workers), frontend (Next.js), postgres

## Project structure

```
docs/
  specs/    — Design spec (authoritative reference for architecture, schema, API surface, phase gates)
  plans/    — phased implementation plan with 27 tasks across 11 phases
reference/  — YAML/MD templates for novel project skeleton (copied from awesome-novel skill)
```

No backend/frontend code exists yet — this is pre-implementation. The design spec (`docs/specs/2026-05-04-multi-user-novel-platform-design.md`) is the single source of truth for all technical decisions.

## Key design decisions

- **Phase gate machine**: Each workflow transition (`init→settings`, `settings→outline`, etc.) has a validation gate. Gate fails → transition rejected, API returns what's missing.
- **6-phase workflow**: init → settings → outline → prompt → write → archive. write→outline is the only backward transition (start next chapter).
- **Filesystem over DB**: Novel content (settings, chapters, prompts, archives) lives as YAML/MD files on disk, not in PostgreSQL. PostgreSQL stores only user/project/system metadata.
- **SSE streaming**: One SSE connection per segment during Phase 5 writing. Frontend can open multiple parallel streams with per-segment pause/stop.
- **Token accounting**: Every AI call logs to `token_log` and deducts from user balance. Pricing by model (haiku: $0.80/$4.00 per M input/output; sonnet: $3/$15).
- **Multi-tenant isolation**: Filesystem `/data/{user_id}/`, DB queries scoped by user_id from JWT, no project sharing in v1.

## Implementation plan phases

0. scaffolding (docker-compose, backend/frontend skeletons)
1. auth (JWT register/login)
2. project CRUD + filesystem init
3. filesystem reader/writer + settings API
4. workflow engine + chapter CRUD
5. prompt assembler (perspective conversion + context injection)
6. streaming write (SSE + quality checks)
7. archive (memory compression + thread/character updates)
8. billing + token tracking
9. frontend shell (project layout + nav)
10. remaining frontend pages (settings, outline, prompts, write, archives, threads)
11. integration & polish
