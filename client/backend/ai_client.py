# backend/ai_client.py
"""AI client — provider-agnostic. Supports Anthropic and OpenAI API formats.

C/S 模式下从本地 config.json 动态读取 API Key/Base URL/Model，而不是从 config.py。
"""

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from sqlalchemy import select

from db import async_session
from models.user import User


@dataclass
class StreamEvent:
    text: str = ""
    is_done: bool = False
    tokens: int = 0
    error: str = ""


class AIClient:
    """Provider-agnostic AI client.

    Config (api_key, base_url, model) is passed at construction time.
    Use get_ai_client_for_user() to create one from DB, or get_ai_client()
    for the backward-compatible singleton with DB-first + config.json fallback.
    """

    def __init__(self, api_key: str = "", base_url: str = "", model: str = "deepseek-v4-flash"):
        self._provider = "anthropic"  # default
        self._client: Any | None = None
        self._model = model
        self._init_client(api_key, base_url)

    def _init_client(self, api_key: str, base_url: str):
        """Initialize the underlying API client with the given credentials."""
        if not api_key:
            raise ValueError("未配置 API Key，请在设置页面填写")

        # 根据 base_url 推断 API 格式
        if "anthropic" in base_url.lower():
            self._provider = "anthropic"
            kwargs = {"api_key": api_key}
            if base_url:
                kwargs["base_url"] = base_url
            self._client = AsyncAnthropic(**kwargs)
        else:
            self._provider = "openai"
            kwargs = {"api_key": api_key}
            if base_url:
                kwargs["base_url"] = base_url
            self._client = AsyncOpenAI(**kwargs)

    def resolve(self, model_name: str) -> str:
        """Map haiku/sonnet → actual model ID.

        如果传入了自定义模型名，直接使用；否则使用配置的模型。
        """
        if model_name in ("haiku", "sonnet", "review"):
            return self._model
        return model_name

    async def chat(
        self,
        model: str,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> str:
        """Non-streaming. Returns full response text."""
        model = self.resolve(model)
        if self._provider == "openai":
            openai_messages: list[dict[str, Any]] = []
            if system:
                openai_messages.append({"role": "system", "content": system})
            for m in messages:
                openai_messages.append({"role": m["role"], "content": m["content"]})
            extra = {"thinking": {"type": "disabled"}}
            if "thinking" in kwargs:
                extra["thinking"] = kwargs.pop("thinking")
            response = await self._client.chat.completions.create(
                model=model,
                messages=openai_messages,
                max_tokens=max_tokens,
                extra_body=extra,
                **kwargs,
            )
            return response.choices[0].message.content or ""
        else:
            response = await self._client.messages.create(
                model=model,
                system=system,
                messages=messages,
                max_tokens=max_tokens,
                **kwargs,
            )
            for block in response.content:
                if getattr(block, "type", "") == "text" and block.text:
                    return block.text
            return ""

    async def chat_stream(
        self,
        model: str,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> AsyncIterator[StreamEvent]:
        """Streaming chat. Yields StreamEvent with text, is_done, tokens."""
        model = self.resolve(model)
        if self._provider == "openai":
            openai_messages: list[dict[str, Any]] = []
            if system:
                openai_messages.append({"role": "system", "content": system})
            for m in messages:
                openai_messages.append({"role": m["role"], "content": m["content"]})
            extra = {"thinking": {"type": "disabled"}}
            if "thinking" in kwargs:
                extra["thinking"] = kwargs.pop("thinking")
            stream = await self._client.chat.completions.create(
                model=model,
                messages=openai_messages,
                max_tokens=max_tokens,
                stream=True,
                extra_body=extra,
                **kwargs,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield StreamEvent(text=delta.content)
            yield StreamEvent(
                is_done=True,
                tokens=getattr(chunk, "usage", None) and chunk.usage.total_tokens or 0,
            )
        else:
            async with self._client.messages.stream(
                model=model,
                system=system,
                messages=messages,
                max_tokens=max_tokens,
                **kwargs,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta":
                        delta_type = getattr(event.delta, "type", "")
                        if delta_type == "text_delta":
                            yield StreamEvent(text=event.delta.text)
                    elif event.type == "message_stop":
                        tokens = 0
                        if hasattr(event, "usage") and event.usage:
                            tokens = event.usage.output_tokens
                        yield StreamEvent(is_done=True, tokens=tokens)


def get_ai_client_for_user(user_id: str | None = None) -> AIClient:
    """Get AI client configured with a user's API settings from DB.

    Falls back to config.json for backward compatibility during migration.
    If user_id is given, looks up that user; otherwise uses the first user in DB.
    """
    try:
        loop = asyncio.new_event_loop()
        try:
            async def _load():
                async with async_session() as session:
                    if user_id:
                        result = await session.execute(select(User).where(User.id == user_id))
                    else:
                        result = await session.execute(select(User).limit(1))
                    user = result.scalar_one_or_none()
                    if user and user.api_key:
                        return AIClient(
                            api_key=user.api_key,
                            base_url=user.api_base_url,
                            model=user.api_model,
                        )
                    return None

            client = loop.run_until_complete(_load())
            if client:
                return client
        finally:
            loop.close()
    except Exception:  # noqa: BLE001, S110
        pass

    # Fallback: read from config.json
    from auth_local.service import get_local_config

    cfg = get_local_config()
    return AIClient(
        api_key=cfg.get("api_key", ""),
        base_url=cfg.get("api_base_url", ""),
        model=cfg.get("api_model", "deepseek-v4-flash"),
    )


def get_ai_client() -> AIClient:
    """Backward-compatible alias. Tries DB first, falls back to config.json."""
    try:
        return get_ai_client_for_user()
    except Exception:  # noqa: BLE001
        from auth_local.service import get_local_config

        cfg = get_local_config()
        return AIClient(
            api_key=cfg.get("api_key", ""),
            base_url=cfg.get("api_base_url", ""),
            model=cfg.get("api_model", "deepseek-v4-flash"),
        )


def create_ai_client() -> AIClient:
    """Alias for get_ai_client() — for callers that use this name."""
    return get_ai_client()


def resolve_model(name: str) -> str:
    return get_ai_client().resolve(name)
