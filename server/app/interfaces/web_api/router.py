from fastapi import APIRouter

router = APIRouter(tags=["web"])

import app.interfaces.web_api.account  # 副作用注册路由
import app.interfaces.web_api.devices
import app.interfaces.web_api.license  # noqa: F401
