import os
from pathlib import Path
from urllib.parse import quote_plus

# Load .env from project root (novel-saas/) or backend/ as fallback
try:
    from dotenv import load_dotenv
    _env_paths = [Path(__file__).parent.parent / ".env", Path(__file__).parent / ".env"]
    for _p in _env_paths:
        if _p.exists():
            load_dotenv(_p)
            break
except ImportError:
    pass


def _build_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    db_host = os.getenv("DB_HOST")
    if db_host:
        db_port = os.getenv("DB_PORT", "3306")
        db_user = os.getenv("DB_USER", "root")
        db_password = quote_plus(os.getenv("DB_PASSWORD", ""))
        db_name = os.getenv("DB_NAME", "novelsaas")
        return f"mysql+asyncmy://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    return "sqlite+aiosqlite:///./novelsaas.db"


DATABASE_URL = _build_database_url()
DATA_ROOT = os.getenv("DATA_ROOT", "./data/projects")
REFERENCE_DIR = os.getenv("REFERENCE_DIR", "")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60
import yaml
from pathlib import Path

# ── AI Config — primary source: ai_config.yaml, fallback: .env ──

_AI_CONFIG_PATH = Path(__file__).parent / "ai_config.yaml"
_ai_cfg = {}
if _AI_CONFIG_PATH.exists():
    _ai_cfg = yaml.safe_load(_AI_CONFIG_PATH.read_text(encoding="utf-8")) or {}

_provider = _ai_cfg.get("provider", {})
_models = _ai_cfg.get("models", {})

# 优先级：YAML > 环境变量 > 空字符串
AI_API_KEY = (
    _provider.get("api_key", "")
    or os.getenv("AI_API_KEY", "")
    or os.getenv("ANTHROPIC_API_KEY", "")
)
AI_BASE_URL = _provider.get("base_url", "") or os.getenv("AI_BASE_URL", "")
AI_MODEL_MAP = {}
for _name, _info in _models.items():
    if isinstance(_info, dict) and "id" in _info:
        AI_MODEL_MAP[_name] = os.getenv(f"AI_MODEL_{_name.upper()}", _info["id"])
# Fallback defaults
AI_MODEL_MAP.setdefault("haiku", os.getenv("AI_MODEL_HAIKU", "deepseek-v4-flash"))
AI_MODEL_MAP.setdefault("sonnet", os.getenv("AI_MODEL_SONNET", "deepseek-v4-pro"))
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
# "database" backend uses MySQL-specific syntax (ON DUPLICATE KEY UPDATE, SUBSTRING_INDEX).
# Designed for CloudBase MySQL — not compatible with PostgreSQL or SQLite.
