# Deployment Guide: Vercel + Render

## Architecture

```
Vercel (Next.js frontend)  →  Render (FastAPI backend + PostgreSQL + Disk)
```

The frontend makes API requests directly to the Render backend. No nginx proxy needed.

## Step 1: Deploy Backend to Render

### 1.1 Push repo to GitHub

Render deploys from GitHub. Push this repo if you haven't already.

### 1.2 Deploy via Render Blueprint

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New** → **Blueprint**
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` and creates:
   - **Web Service** `novel-saas-api` (Python/FastAPI)
   - **PostgreSQL** `novel-saas-db`
   - **Disk** `novel-data` (1 GB, mounted at `/data/projects`)

### 1.3 Set Required Environment Variables

In the `novel-saas-api` web service dashboard → **Environment**, set:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

These are already configured by `render.yaml`:
- `DATABASE_URL` → auto-linked from PostgreSQL
- `JWT_SECRET` → auto-generated
- `DATA_ROOT` → `/data/projects`
- `REFERENCE_DIR` → `/opt/render/project/src/reference`
- `CORS_ORIGINS` → `*` (update after frontend deploy)

### 1.4 Note the Backend URL

After deploy, note your backend URL (e.g., `https://novel-saas-api.onrender.com`).

## Step 2: Deploy Frontend to Vercel

### 2.1 Import Project

1. Go to [vercel.com](https://vercel.com)
2. Click **New Project** → import the same GitHub repo
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js (auto-detected)

### 2.2 Set Environment Variables

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://novel-saas-api.onrender.com/api` |

Replace with your actual Render backend URL.

### 2.3 Deploy

Click **Deploy**. Vercel builds the Next.js app and gives you a URL (e.g., `https://novel-forge.vercel.app`).

## Step 3: Update CORS

After you have the Vercel domain:

1. Go to Render dashboard → `novel-saas-api` → Environment
2. Update `CORS_ORIGINS` from `*` to `https://your-app.vercel.app`

## Local Development

```bash
# Backend
docker compose up -d postgres
cd backend && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

The local frontend uses `/api` with Next.js rewrites to `localhost:8000`, matching the docker compose setup.

## Limitations

- **SSE timeout**: Render free tier has a 100-second request timeout. Long writing sessions may need reconnection handling.
- **Rate limiter**: Uses in-memory storage; resets on deploy/restart.
- **Database**: Tables auto-created on startup via SQLAlchemy. No migration system yet.
- **Cold starts**: Render free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s.
