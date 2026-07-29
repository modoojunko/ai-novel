"""C端 API 路由注册。"""
from __future__ import annotations
from fastapi import APIRouter

router = APIRouter(tags=["client"])

import app.interfaces.client_api.authorize  # noqa: E402,F811
import app.interfaces.client_api.devices    # noqa: E402,F811
import app.interfaces.client_api.account    # noqa: E402,F811
import app.interfaces.client_api.verify     # noqa: E402,F811
