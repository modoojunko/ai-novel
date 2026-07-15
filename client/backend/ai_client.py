# backend/ai_client.py
"""AI client — provider-agnostic. Supports Anthropic and OpenAI API formats.

C/S 模式下从本地 config.json 动态读取 API Key/Base URL/Model，而不是从 config.py。
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Optional

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI


@dataclass
class StreamEvent:
    text: str = ""
    is_done: bool = False
    tokens: int = 0
    error: str = ""


class AIClient:
    """Provider-agnostic AI client.

    C/S 模式下每次创建时从本地 config.json 读取 API Key 配置。
    支持用户在运行时切换 API Key/Base URL/Model，无需重启。
    """

    def __init__(self):
        self._provider = "anthropic"  # default
        self._client: Optional[Any] = None
        self._reload()

    def _reload(self):
        """从本地配置重新加载 API 设置"""
        from auth_local.service import get_local_config

        cfg = get_local_config()
        api_key = cfg.get("api_key", "")
        base_url = cfg.get("api_base_url", "")
        self._model = cfg.get("api_model", "deepseek-v4-flash")

        if not api_key:
            raise ValueError("未配置 API Key，请在设置页面填写")

        # 根据 base_url 推断 API 格式
        if "anthropic" in base_url:
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


# Singleton
_client: AIClient | None = None


def get_ai_client() -> AIClient:
    global _client
    if _client is None:
        _client = AIClient()
    return _client


def create_ai_client() -> AIClient:
    """Alias for get_ai_client() — for callers that use this name."""
    return get_ai_client()


def resolve_model(name: str) -> str:
    return get_ai_client().resolve(name)
