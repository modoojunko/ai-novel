from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import Base, engine

import models  # noqa: F401 — register models with Base

from auth.router import router as auth_router
from projects.router import router as projects_router
from settings.router import router as settings_router
from chapters.router import router as chapters_router
from prompt.router import router as prompt_router
from write.router import router as write_router
from archive.router import router as archive_router
from billing.router import router as billing_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Novel SaaS", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(settings_router)
app.include_router(chapters_router)
app.include_router(prompt_router)
app.include_router(write_router)
app.include_router(archive_router)
app.include_router(billing_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
