# backend/main.py
"""AI Novel — C/S 架构本地服务"""

import json
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

import models  # noqa: F401
from archive.router import archives_router
from archive.router import router as archive_router

# License 本地验证
from auth_local.router import router as auth_local_router
from chapters.router import router as chapters_router
from chapters.versions import router as chapters_versions_router
from db import Base, async_session, engine
from genres.router import router as genres_router
from models.user import User
from novel.router import router as novel_router
from projects.router import ai_router
from projects.router import router as projects_router
from prompt.router import router as prompt_router
from settings.ai_router import router as settings_ai_router
from settings.router import router as settings_router
from settings.status import router as settings_status_router
from story.router import router as story_router
from threads.router import router as threads_router
from workflow.router import router as workflow_router
from write.router import router as write_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except SQLAlchemyError as e:
        import logging

        logging.getLogger("uvicorn.error").warning("Failed to create tables: %s", e)

    # ── Migrate config.json → User table ────────────────────────────
    try:
        cfg_path = os.path.join(os.environ.get("DATA_ROOT", "./data"), "config.json")
        if os.path.exists(cfg_path):
            with open(cfg_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            if cfg:
                async with async_session() as session:
                    result = await session.execute(select(User).limit(1))
                    user = result.scalar_one_or_none()
                    if user:
                        changed = False
                        for field in ["api_key", "api_base_url", "api_model", "token", "pc_hash", "pc_name", "server_api"]:
                            if cfg.get(field):
                                setattr(user, field, cfg[field])
                                changed = True
                        # Map legacy license fields
                        if cfg.get("tier") and not user.plan:
                            user.plan = cfg["tier"]
                            changed = True
                        if cfg.get("expires_at") and not user.subscription_expires_at:
                            try:
                                from datetime import date
                                user.subscription_expires_at = date.fromisoformat(cfg["expires_at"])
                                changed = True
                            except ValueError:
                                pass
                        if cfg.get("last_login_at") and not user.activated_at:
                            try:
                                user.activated_at = datetime.fromisoformat(cfg["last_login_at"])
                                changed = True
                            except ValueError:
                                pass
                        if changed:
                            await session.commit()
            # Clear config.json after migration
            with open(cfg_path, "w", encoding="utf-8") as f:
                json.dump({}, f)
    except Exception as e:  # noqa: BLE001
        import logging
        logging.getLogger("uvicorn.error").warning("Config migration failed: %s", e)
    yield


app = FastAPI(title="AI Novel (Local)", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# License 验证路由
app.include_router(auth_local_router, prefix="/api/auth", tags=["auth"])

# 业务路由
app.include_router(ai_router)
app.include_router(projects_router)
app.include_router(settings_router)
app.include_router(settings_status_router)
app.include_router(settings_ai_router)
app.include_router(chapters_router)
app.include_router(prompt_router)
app.include_router(write_router)
app.include_router(archive_router)
app.include_router(archives_router)
app.include_router(threads_router)
app.include_router(novel_router)
app.include_router(chapters_versions_router)
app.include_router(story_router)
app.include_router(workflow_router)
app.include_router(genres_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "mode": "local"}


# 挂载前端静态文件 — 放在最后避免拦截 API 路由
# 开发态: client/backend/../frontend/dist
# 打包态: 通过 FRONTEND_DIST 环境变量指定（由 pywebview_app.py 设置）
frontend_dist = os.environ.get("FRONTEND_DIST") or os.path.join(
    os.path.dirname(__file__), "..", "frontend", "dist"
)
if frontend_dist and os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
