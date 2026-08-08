"""Pytest configuration -- stubs external modules + session-level test DB base."""

import asyncio
import os
import sys
import tempfile
import types

import pytest

# Stub the `anthropic` module so tests can import story modules
# without the real SDK being installed.
if "anthropic" not in sys.modules:
    anthropic = types.ModuleType("anthropic")
    anthropic.__version__ = "0.0.0"

    class AsyncAnthropic:
        def __init__(self, *args, **kwargs):
            pass

    anthropic.AsyncAnthropic = AsyncAnthropic
    sys.modules["anthropic"] = anthropic

    # Also stub anthropic.lib.streaming if accessed
    _streaming = types.ModuleType("anthropic.lib")
    _streaming.__path__ = []
    sys.modules["anthropic.lib"] = _streaming

    _streaming_stream = types.ModuleType("anthropic.lib.streaming")
    sys.modules["anthropic.lib.streaming"] = _streaming_stream

# Stub the `openai` module
if "openai" not in sys.modules:
    openai_mod = types.ModuleType("openai")
    openai_mod.__version__ = "0.0.0"

    class AsyncOpenAI:
        def __init__(self, *args, **kwargs):
            pass

    openai_mod.AsyncOpenAI = AsyncOpenAI
    sys.modules["openai"] = openai_mod

    # Stub openai.types.chat if accessed
    _types = types.ModuleType("openai.types")
    _types.__path__ = []
    sys.modules["openai.types"] = _types

    _chat = types.ModuleType("openai.types.chat")
    sys.modules["openai.types.chat"] = _chat


# ── Session-level test database base ─────────────────────────────────────────
# 组合后端（ADR-001）mapped 路径写 DB：未自设 DATABASE_URL 的测试若触库，
# 落在临时库而非真实 ./data/novel.db。自设 DATABASE_URL 的测试在各模块顶部
# 覆盖这两个变量（engine 模块级缓存，第一个 import 者生效），维持现状。
_TMP_DATA_ROOT = tempfile.mkdtemp(prefix="ai-novel-test-data-")
os.environ["DATA_ROOT"] = _TMP_DATA_ROOT
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{os.path.join(_TMP_DATA_ROOT, 'novel.db')}"


@pytest.fixture(scope="session", autouse=True)
def _session_test_db():
    """建表基座：任何测试触碰 DB 前，表已建好（含 project_settings）。

    import models 注册全部表——否则纯文件测试单独跑时 Base.metadata 为空，
    create_all 建不出 project_settings，组合后端写 DB 报 no such table。
    """
    import models  # noqa: F401

    from db import Base, engine

    async def _create_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_create_tables())
    yield
