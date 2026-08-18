"""导入所有模型，供 Alembic 自动检测。"""
from app.models.base import Base
from app.models.code import ActivationCodeORM
from app.models.config import GlobalConfigORM
from app.models.device import DeviceRegistryORM
from app.models.grant import DeviceGrantORM
from app.models.user import UserORM

__all__ = [
    "ActivationCodeORM",
    "Base",
    "DeviceGrantORM",
    "DeviceRegistryORM",
    "GlobalConfigORM",
    "UserORM",
]
