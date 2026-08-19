from fastapi import APIRouter

router = APIRouter(tags=["admin"])

import app.interfaces.admin_api.codes  # noqa
