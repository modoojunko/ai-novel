"""AI client — provider-agnostic. Supports Anthropic and OpenAI API formats."""

import json
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from anthropic import AsyncAnthropic
from anthropic.types import Usage as AnthropicUsage
from openai import AsyncOpenAI

from config import AI_API_KEY, AI_BASE_URL, AI_MODEL_MAP, AI_API_FORMAT


@dataclass
class StreamEvent:
    text: str = ""
    is_done: bool = False
    tokens: int = 0
    error: str = ""


class AIClient:
    """Provider-agnostic AI client.

    Usage:
        client = AIClient()
        text = await client.chat(model="haiku", system="...", messages=[...])
        async for event in client.chat_stream(model="haiku", system="...", messages=[...]):
            print(event.text)
    """

    def __init__(self):
        self._provider = AI_API_FORMAT  # "anthropic" or "openai"
        if self._provider == "openai":
            kwargs: dict[str, Any] = {"api_key": AI_API_KEY}
            if AI_BASE_URL:
                kwargs["base_url"] = AI_BASE_URL
            self._client = AsyncOpenAI(**kwargs)
        else:
            kwargs = {"api_key": AI_API_KEY}
            if AI_BASE_URL:
                kwargs["base_url"] = AI_BASE_URL
            self._client = AsyncAnthropic(**kwargs)

    def resolve(self, model_name: str) -> str:
        """Map haiku/sonnet → actual model ID."""
        return AI_MODEL_MAP.get(model_name, model_name)

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
            response = await self._client.chat.completions.create(
                model=model,
                messages=openai_messages,
                max_tokens=max_tokens,
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
            # DeepSeek returns thinking blocks by default — skip them, take the first text block
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
            stream = await self._client.chat.completions.create(
                model=model,
                messages=openai_messages,
                max_tokens=max_tokens,
                stream=True,
                **kwargs,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield StreamEvent(text=delta.content)
            yield StreamEvent(is_done=True, tokens=getattr(chunk, "usage", None) and chunk.usage.total_tokens or 0)
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
                        # Skip thinking_delta blocks
                    elif event.type == "message_stop":
                        tokens = 0
                        if hasattr(event, "usage") and event.usage:
                            tokens = event.usage.output_tokens
                        yield StreamEvent(is_done=True, tokens=tokens)


# Singleton
_client: AIClient | None = None


def get_ai_client() -> AIClient:
    global _client
    if _client is None:
        _client = AIClient()
    return _client


def resolve_model(name: str) -> str:
    return get_ai_client().resolve(name)
