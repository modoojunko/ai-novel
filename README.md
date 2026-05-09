# AI Novel · 爱小说

AI-assisted long-form novel writing platform. Take your story from idea to archive through a structured 6-phase workflow — worldbuilding, outlining, prompt engineering, streaming prose generation, and archival.

Built for Chinese-language novelists who want AI as a creative partner, not a ghostwriter. Every story decision stays in your hands.

## 6-Phase Workflow

```
init → settings → outline → prompt → write → archive
```

| Phase | What happens |
|-------|-------------|
| **1. Init** | Create project, set up the novel skeleton |
| **2. Settings** | World, characters, writing style, anti-AI patterns, thread hooks |
| **3. Outline** | Volume structure, chapter outlines with emotional beats |
| **4. Prompt** | Segment breakdown, perspective conversion, per-segment prompt assembly |
| **5. Write** | Streaming SSE generation with 6 quality checks, real-time pause/cancel |
| **6. Archive** | Finalize to archives, update characters, threads, and hooks |

Each phase transition runs through a validation gate — you can't skip ahead with missing prerequisites.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Anthropic SDK |
| Frontend | Next.js 14 (App Router), TypeScript, shadcn/ui, Tailwind CSS |
| Database | PostgreSQL 16 |
| Streaming | SSE (Server-Sent Events) |
| Deploy | Docker Compose — nginx, uvicorn, Next.js, postgres |

## Quick Start

```bash
# Clone
git clone https://github.com/modoojunko/ai-novel.git
cd ai-novel

# Configure
cp .env.example .env
# Edit .env — set JWT_SECRET, ANTHROPIC_API_KEY, CORS_ORIGINS

# Launch
docker compose up -d

# Smoke test
./scripts/e2e-test.sh
```

The app runs at `http://localhost:3000`. API at `http://localhost:8000`.

## Architecture

Novel content (settings, chapters, prompts, archives) lives as YAML + Markdown files on disk. PostgreSQL stores only user, project, session, and token metadata.

```
Nginx → /api/* → FastAPI (uvicorn) → PostgreSQL + filesystem
      → /*     → Next.js 14
```

Single-host Docker Compose. No Redis, no Celery, no Kubernetes.

## License

GNU GPLv3. See [LICENSE](LICENSE).

## Contact

Business inquiries: **alexee_zhu@foxmail.com**
