import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://novel:novel@localhost:5432/novelsaas")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
DATA_ROOT = os.getenv("DATA_ROOT", "/data/projects")
