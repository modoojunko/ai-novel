"""API Key 验证器 — 支持 OpenAI 和 Anthropic 两种格式"""

from typing import Protocol, runtime_checkable

import httpx


@runtime_checkable
class Verifier(Protocol):
    """Key 验证器接口"""

    async def verify(self, api_key: str, base_url: str) -> dict: ...


class AnthropicVerifier:
    """Anthropic 原生格式验证（DeepSeek Anthropic兼容端点也走此路）"""

    async def verify(self, api_key: str, base_url: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{base_url}/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "ping"}],
                },
            )
            if resp.status_code == 200:
                return {"valid": True, "provider": "anthropic"}
            detail = ""
            try:
                detail = resp.json().get("error", {}).get("message", resp.text[:200])
            except (ValueError, KeyError, TypeError):
                detail = resp.text[:200]
            return {"valid": False, "error": detail}


class OpenAICompatibleVerifier:
    """OpenAI 兼容格式验证（OpenAI / 兼容端点）"""

    async def verify(self, api_key: str, base_url: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                return {"valid": True, "provider": "openai"}
            return {"valid": False, "error": resp.text[:200]}


class MockVerifier:
    """测试用 Mock — 始终返回有效"""

    async def verify(self, api_key: str, base_url: str) -> dict:
        return {"valid": True, "provider": "mock", "model": "mock-model"}


def get_verifier(base_url: str) -> Verifier:
    """根据 base_url 自动选择验证器"""
    if "anthropic" in base_url.lower():
        return AnthropicVerifier()
    return OpenAICompatibleVerifier()
