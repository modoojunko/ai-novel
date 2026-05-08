import os
from urllib.parse import quote_plus

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
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
# "database" backend uses MySQL-specific syntax (ON DUPLICATE KEY UPDATE, SUBSTRING_INDEX).
# Designed for CloudBase MySQL — not compatible with PostgreSQL or SQLite.
