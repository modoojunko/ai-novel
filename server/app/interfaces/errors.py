"""全局异常处理器。"""
from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("api.errors")


def register_handlers(app):
    @app.exception_handler(Exception)
    async def _global_exception_handler(request: Request, exc: Exception):
        logger.exception(
            "event=unhandled_error path=%s method=%s err=%s",
            request.url.path, request.method, exc,
        )
        return JSONResponse(
            status_code=500,
            content={"code": -1, "msg": "内部错误，请查看服务器日志"},
        )
