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

    from app.interfaces.admin_api import admin_router
    from app.interfaces.client_api import client_router
    from app.interfaces.web_api import web_router

    app.include_router(client_router)
    app.include_router(web_router)
    app.include_router(admin_router)

    return app


app = create_app()


@app.on_event("startup")
def on_startup():
    """启动时自动建表 + 检查 Alembic 迁移版本（仅 sqlite 后端；pg_http 表已预建）。"""
    import logging
    logger = logging.getLogger("app")
    logger.info("event=app.start db_backend=%s db_path=%s", settings.DB_BACKEND, settings.DB_PATH)

    if settings.DB_BACKEND == "pg_http":
        # CloudBase PG 表结构由管理端 MCP applyMigration 预建，应用启动不迁移
        logger.info("event=app.started version=%s db_backend=pg_http", "2.1.0")
        return

    # 先跑 alembic 迁移（空库上正常建表并打标 alembic_version），
    # 再 create_all 兜底（checkfirst 默认跳过已存在表）——避免 fresh DB 上
    # create_all 先建表导致 alembic 迁移的 create_table 冲突。
    alembic_dir = Path(__file__).parent.parent / "alembic"
    if alembic_dir.exists():
        try:
            from alembic.config import Config

            from alembic import command
            server_dir = Path(__file__).parent.parent
            # 不加载 alembic.ini（config_file_name=None）：env.py 里 fileConfig(ini)
            # 默认 disable_existing_loggers=True，会把 app/api/uvicorn 的 logger 全部禁用，
            # 而 dictConfig(disable_existing_loggers=False) 无法复活未显式配置的子 logger
            # （如 api.access），导致访问日志全程失声。script_location 显式传入即可。
            alembic_cfg = Config()
            alembic_cfg.set_main_option("script_location", str(server_dir / "alembic"))
            command.upgrade(alembic_cfg, "head")
            setup_logging()
            logger = logging.getLogger("app")
            logger.info("event=app.migration action=alembic_upgrade result=ok")
        except Exception as e:
            setup_logging()
            logger = logging.getLogger("app")
            logger.warning("event=app.migration action=alembic_upgrade result=fail error=%s", e)

    logger.info("event=app.migration action=create_all")
    Base.metadata.create_all(bind=engine)

    logger.info("event=app.started version=%s db_path=%s", "2.1.0", settings.DB_PATH)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
