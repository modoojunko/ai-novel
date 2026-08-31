from fastapi import APIRouter

router = APIRouter(tags=["web"])

import app.interfaces.web_api.account  # 副作用注册路由
import app.interfaces.web_api.devices
import app.interfaces.web_api.license  # noqa: F401

# payments + dev_inject + cron 是独立子路由，需 include
from app.interfaces.web_api.cron import r as cron_router
from app.interfaces.web_api.dev_inject import r as dev_router
from app.interfaces.web_api.payments import r as pay_router

router.include_router(pay_router)
router.include_router(dev_router)
router.include_router(cron_router)
