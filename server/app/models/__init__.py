"""导入所有模型，供 Alembic 自动检测。"""
from app.models.base import Base
from app.models.user import UserORM
from app.models.code import ActivationCodeORM
from app.models.device import DeviceRegistryORM
from app.models.grant import DeviceGrantORM
from app.models.config import GlobalConfigORM

__all__ = [
    "Base", "UserORM", "ActivationCodeORM",
    "DeviceRegistryORM", "DeviceGrantORM", "GlobalConfigORM",
]
