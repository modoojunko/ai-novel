# backend/config.py
"""本地应用配置 — C/S 架构"""

import os

# 数据目录
DATA_ROOT = os.environ.get("DATA_ROOT", "./data")
PROJECTS_DIR = os.path.join(DATA_ROOT, "projects")

# 数据库路径
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{DATA_ROOT}/novel.db"
)

# AI 配置（运行时从 config.json 动态读取）
DEFAULT_AI_BASE_URL = "https://api.deepseek.com/anthropic"
DEFAULT_AI_MODEL = "deepseek-v4-flash"

# JWT（本地存 token 用）
JWT_SECRET = os.environ.get("JWT_SECRET", "local-license-secret")
JWT_ALGORITHM = "HS256"

# 模板路径 — 相对于 config.py 的位置 (client/backend/config.py → ../reference/)
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
REFERENCE_DIR = os.environ.get("REFERENCE_DIR", os.path.join(_THIS_DIR, "..", "reference"))

# 存储后端（C/S 模式下固定为 local）
STORAGE_BACKEND = "local"

# S 端 CloudBase API 地址
SERVER_API_BASE = os.environ.get(
    "SERVER_API_BASE",
    "https://your-cloudbase-app.com/api"
)
