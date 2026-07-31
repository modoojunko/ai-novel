"""中间件：访问日志、request_id、CORS、速率限制。"""
from __future__ import annotations
import uuid
import time
import logging
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from app.infrastructure.logging import RequestIDFilter

logger = logging.getLogger("api.access")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """基于 IP 的速率限制。"""

    SENSITIVE_PATHS = {"/api/authorize", "/api/web/login"}
    # 5→30：吸收 E2E 套件的登录突发（/api/web/login）；C端 轮询走 GET
    # /api/check-auth 不受限，30/min/IP 仍可防爆破，避免误伤多管理员同网段
    LIMIT = 30
    WINDOW = 60  # 秒

    def __init__(self, app):
        super().__init__(app)
        self._history: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.SENSITIVE_PATHS and request.method == "POST":
            ip = request.client.host if request.client else "unknown"
            now = time.time()
            cutoff = now - self.WINDOW
            self._history[ip] = [t for t in self._history[ip] if t > cutoff]
            if len(self._history[ip]) >= self.LIMIT:
                logger.warning("event=rate_limit_exceeded ip=%s path=%s", ip, request.url.path)
                return JSONResponse(
                    status_code=429,
                    content={"code": 2, "msg": "请求过于频繁，请稍后再试"},
                )
            self._history[ip].append(now)
        return await call_next(request)


class AccessLogMiddleware(BaseHTTPMiddleware):
    """记录所有请求的访问日志 + 设置 request_id contextvar。"""

    async def dispatch(self, request: Request, call_next):
        request_id = uuid.uuid4().hex[:6]
        RequestIDFilter.set(request_id)
        start = time.time()
        response = await call_next(request)
        dur_ms = int((time.time() - start) * 1000)
        logger.info(
            "%s %s -> %s dur=%dms",
            request.method, request.url.path, response.status_code, dur_ms,
        )
        return response


def register_middleware(app):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(AccessLogMiddleware)
