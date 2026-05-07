import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./novelsaas.db")
DATA_ROOT = os.getenv("DATA_ROOT", "./data/projects")
REFERENCE_DIR = os.getenv("REFERENCE_DIR", "")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
