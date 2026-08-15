from __future__ import annotations
import logging
import os
from pathlib import Path


class Settings:
    """所有配置集中读取环境变量，不可变（使用者只读）。"""

    # ── 服务 ──
    PORT: int = int(os.getenv("PORT", "19000"))
    HOST: str = os.getenv("HOST", "127.0.0.1")

    # ── 数据库 ──
    # sqlite（默认，本地开发/测试，现有测试零改动）
    # pg_http（生产：CloudBase PostgreSQL 经 PostgREST HTTP API 访问，体验版套餐无需 TCP 直连）
    DB_BACKEND: str = os.getenv("DB_BACKEND", "sqlite")
    DB_DIR: Path = Path(os.getenv("DB_DIR", Path(__file__).parent.parent))
    DB_PATH: str = str(DB_DIR / os.getenv("DB_NAME", "license.db"))

    # ── CloudBase PG（DB_BACKEND=pg_http 时）──
    TCB_PG_ENV_ID: str = os.getenv("TCB_PG_ENV_ID", "")
    TCB_PG_API_KEY: str = os.getenv("TCB_PG_API_KEY", "")

    @property
    def DATABASE_URL(self) -> str:
        """数据库连接串。显式设置 DATABASE_URL（如 postgresql://...）时使用之，
        否则回退 SQLite（路径跟随 DB_DIR/DB_NAME，便于测试覆盖 DB_PATH）。"""
        return os.getenv("DATABASE_URL", "") or f"sqlite:///{self.DB_PATH}"

    @property
    def TCB_PG_ENDPOINT(self) -> str:
        """CloudBase PG PostgREST 端点，默认按环境 ID 推导。"""
        return os.getenv("TCB_PG_ENDPOINT", "") or (
            f"https://{self.TCB_PG_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest"
            if self.TCB_PG_ENV_ID
            else ""
        )

    # ── JWT ──
    JWT_SECRET: str = os.getenv("JWT_SECRET", "local-license-secret")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 30

    # ── Admin ──
    ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "admin123")

    # ── 日志 ──
    LOG_DIR: str = os.getenv("LOG_DIR", str(DB_DIR / "logs"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "s-server.log")
    LOG_MAX_BYTES: int = 5 * 1024 * 1024  # 5MB
    LOG_BACKUP_COUNT: int = 5

    # ── 套餐配置（硬编码，将来可迁到 DB）──
    TIER_POLICY: dict = {
        "none":     {"device_limit": 0,  "duration_days": 0,    "display": "无套餐"},
        "trial":    {"device_limit": 1,  "duration_days": 7,    "display": "试用"},
        "free":     {"device_limit": 1,  "duration_days": 0,    "display": "免费"},
        "monthly":  {"device_limit": 3,  "duration_days": 30,   "display": "月付"},
        "quarterly":{"device_limit": 3,  "duration_days": 90,   "display": "季付"},
        "yearly":   {"device_limit": 5,  "duration_days": 365,  "display": "年付"},
        "lifetime": {"device_limit": 10, "duration_days": 36500,"display": "永久"},
    }
    TIER_POLICY["lifetime"]["device_limit"] = 99


settings = Settings()  # 模块级单例，全局引用 from app.config import settings

# #5 生产安全：检测弱默认密钥并告警（开箱即跑保留默认值，但生产须显式设置强随机值）
if settings.JWT_SECRET == "local-license-secret" or settings.ADMIN_TOKEN == "admin123":
    logging.getLogger(__name__).warning(
        "检测到弱默认密钥（JWT_SECRET/ADMIN_TOKEN）——生产环境请通过环境变量设置强随机值"
    )
