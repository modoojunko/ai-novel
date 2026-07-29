from __future__ import annotations
import logging
import logging.config
import sys
from pathlib import Path

from app.config import settings


LOG_FORMAT = (
    "%(asctime)s.%(msecs)03d+08:00 | %(levelname)-5s | %(name)-20s | "
    "req=%(request_id)s | %(message)s"
)
DATE_FORMAT = "%Y-%m-%dT%H:%M:%S"


class RequestIDFilter(logging.Filter):
    """向每个 LogRecord 注入 request_id 字段。"""
    import contextvars
    request_id_var = contextvars.ContextVar("request_id", default="-")

    @classmethod
    def set(cls, rid: str) -> None:
        cls.request_id_var.set(rid)

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = self.request_id_var.get("-")
        return True


_LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": LOG_FORMAT,
            "datefmt": DATE_FORMAT,
        },
    },
    "filters": {
        "request_id": {
            "()": RequestIDFilter,
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": settings.LOG_LEVEL,
            "formatter": "standard",
            "filters": ["request_id"],
            "stream": sys.stdout,
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": settings.LOG_LEVEL,
            "formatter": "standard",
            "filters": ["request_id"],
            "filename": str(Path(settings.LOG_DIR) / settings.LOG_FILE),
            "maxBytes": settings.LOG_MAX_BYTES,
            "backupCount": settings.LOG_BACKUP_COUNT,
            "encoding": "utf-8",
        },
    },
    "loggers": {
        "app": {"level": settings.LOG_LEVEL, "handlers": ["console", "file"], "propagate": False},
        "api": {"level": settings.LOG_LEVEL, "handlers": ["console", "file"], "propagate": False},
        "sqlalchemy": {"level": "WARNING", "handlers": ["console"], "propagate": False},
    },
    "root": {"level": "WARNING", "handlers": ["console", "file"]},
}


def setup_logging():
    """初始化日志。在 app.main 启动时调用一次。"""
    Path(settings.LOG_DIR).mkdir(parents=True, exist_ok=True)
    logging.config.dictConfig(_LOGGING_CONFIG)
