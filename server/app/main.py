"""FastAPI 应用入口。"""
from __future__ import annotations
import sys
from pathlib import Path

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import uvicorn
from fastapi import FastAPI

from app.config import settings
from app.infrastructure.logging import setup_logging
from app.interfaces.errors import register_handlers
from app.interfaces.middleware import register_middleware
from app.models.base import Base, engine


def create_app() -> FastAPI:
    """应用工厂。"""
    setup_logging()

    app = FastAPI(
        title="AI Novel - S Server",
        version="2.0.0",
        description="License 授权与设备管理服务（重构版）",
    )

    register_middleware(app)
    register_handlers(app)

    from app.interfaces.client_api import client_router
    from app.interfaces.web_api import web_router
    from app.interfaces.admin_api import admin_router

    app.include_router(client_router)
    app.include_router(web_router)
    app.include_router(admin_router)

    return app


app = create_app()


@app.on_event("startup")
def on_startup():
    """启动时自动建表 + 检查 Alembic 迁移版本。"""
    import logging
    import subprocess
    logger = logging.getLogger("app")
    logger.info("event=app.start db_path=%s", settings.DB_PATH)

    logger.info("event=app.migration action=create_all")
    Base.metadata.create_all(bind=engine)

    alembic_dir = Path(__file__).parent.parent / "alembic"
    if alembic_dir.exists():
        try:
            result = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                cwd=str(Path(__file__).parent.parent),
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                logger.info("event=app.migration action=alembic_upgrade result=ok")
            else:
                logger.warning(
                    "event=app.migration action=alembic_upgrade result=fail stderr=%s",
                    result.stderr[:200],
                )
        except Exception as e:
            logger.warning("event=app.migration action=alembic_check error=%s", e)

    logger.info("event=app.started version=%s db_path=%s", "2.0.0", settings.DB_PATH)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
