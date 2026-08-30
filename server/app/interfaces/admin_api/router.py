from fastapi import APIRouter

router = APIRouter(tags=["admin"])

import app.interfaces.admin_api.codes  # noqa
import app.interfaces.admin_api.deletion  # noqa
