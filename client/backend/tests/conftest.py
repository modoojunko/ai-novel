"""Pytest configuration -- stubs external modules that may not be installed."""

import sys
import types

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
