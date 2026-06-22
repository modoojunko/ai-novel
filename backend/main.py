import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from db import Base, engine

import models  # noqa: F401 — register models with Base

from auth.router import router as auth_router
from projects.router import ai_router, router as projects_router
from settings.router import router as settings_router
from chapters.router import router as chapters_router
from prompt.router import router as prompt_router
from write.router import router as write_router
from archive.router import archives_router, router as archive_router
from billing.router import router as billing_router
from threads.router import router as threads_router
from novel.router import router as novel_router

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 60, window: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window
        self.hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/health":
            return await call_next(request)

        client = request.headers.get(
            "X-Forwarded-For", request.client.host if request.client else "unknown"
        )
        now = time.monotonic()
        self.hits[client] = [t for t in self.hits[client] if now - t < self.window]

        if len(self.hits[client]) >= self.max_requests:
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)

        self.hits[client].append(now)
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("AUTO_CREATE_TABLES", "1") != "0":
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        except Exception:
            import logging

            logging.getLogger("uvicorn.error").warning(
                "Failed to auto-create tables (may already exist or permissions insufficient)"
            )
    yield


app = FastAPI(title="AI Novel", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, max_requests=120, window=60)

app.include_router(ai_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(settings_router)
app.include_router(chapters_router)
app.include_router(prompt_router)
app.include_router(write_router)
app.include_router(archive_router)
app.include_router(archives_router)
app.include_router(billing_router)
app.include_router(threads_router)
app.include_router(novel_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
