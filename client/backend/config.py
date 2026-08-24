# backend/config.py
"""本地应用配置 — C/S 架构"""

import os

# 数据目录
DATA_ROOT = os.environ.get("DATA_ROOT", "./data")
PROJECTS_DIR = os.path.join(DATA_ROOT, "projects")

# 数据库路径
DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite+aiosqlite:///{DATA_ROOT}/novel.db"
)

# AI 配置（通过 C端 UI 配置，写入 config.json）

# 设定模板路径 — 相对于 config.py 的位置 (client/backend/config.py → reference/)。
# 只有 seed_settings_to_db 消费的 5 个 *.yaml.template；冻结包由 pywebview_app 注入 env 覆盖。
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
REFERENCE_DIR = os.environ.get(
    "REFERENCE_DIR", os.path.join(_THIS_DIR, "reference")
)

# S 端 CloudBase API 地址
SERVER_API_BASE = os.environ.get(
    "SERVER_API_BASE", "https://your-cloudbase-app.com/api"
)
