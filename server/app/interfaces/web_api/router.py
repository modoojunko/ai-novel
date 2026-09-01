from fastapi import APIRouter

router = APIRouter(tags=["web"])


# payments + dev_inject + cron 是独立子路由，需 include
from app.interfaces.web_api.cron import r as cron_router
from app.interfaces.web_api.dev_inject import r as dev_router
from app.interfaces.web_api.payments import r as pay_router

router.include_router(pay_router)
router.include_router(dev_router)
router.include_router(cron_router)
# web_api/license.py（/api/license/activate 激活码端点）已随 8.3 拆除——
# 购买流程统一走 /api/pay/orders；管理端出码 /api/generate_code 保留
