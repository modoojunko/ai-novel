from fastapi import APIRouter
router = APIRouter(tags=["web"])

import app.interfaces.web_api.account   # noqa
import app.interfaces.web_api.license   # noqa
import app.interfaces.web_api.devices   # noqa
