"""Connection testing — vendor-specific health check.

Each vendor's model-list endpoint is used as a lightweight connectivity
probe.  The response is parsed to extract available model IDs where
possible, otherwise just success/failure is reported.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

CONNECTION_TEST_TIMEOUT = int(os.environ.get("API_CONFIG_TEST_TIMEOUT", "10"))


async def test_connection(
    vendor_id: str,
    api_key: str,
    base_url: str,
    timeout: int = CONNECTION_TEST_TIMEOUT,
) -> dict[str, Any]:
    """Test connectivity to a vendor's API.

    Returns a dict with:
        ok          — whether the probe succeeded (2xx)
        status      — one of "ok", "auth_error", "rate_limited",
                      "timeout", "network_error"
        models      — list of model IDs extracted, or None on failure
        error       — human-readable error string (only on failure)
    """
    # Some vendors (Ollama) don't require an API key
    requires_key = vendor_id != "ollama"
    if requires_key and not api_key.strip():
        return {
            "ok": False,
            "status": "auth_error",
            "models": None,
            "error": "API Key 为空，请填写后再测试",
        }

    endpoint, headers, extract_fn = _build_probe(vendor_id, api_key, base_url)
    if endpoint is None:
        return {
            "ok": False,
            "status": "network_error",
            "models": None,
            "error": "不支持的供应商",
        }

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(endpoint, headers=headers)
    except httpx.TimeoutException:
        return {"ok": False, "status": "timeout", "models": None, "error": "连接超时"}
    except httpx.ConnectError:
        return {
            "ok": False,
            "status": "network_error",
            "models": None,
            "error": "无法连接服务器",
        }
    except httpx.RequestError as exc:
        return {
            "ok": False,
            "status": "network_error",
            "models": None,
            "error": f"网络错误: {exc}",
        }

    if resp.status_code == 401 or resp.status_code == 403:
        detail = _extract_error_detail(resp)
        return {
            "ok": False,
            "status": "auth_error",
            "models": None,
            "error": f"认证失败 (HTTP {resp.status_code}){detail}",
        }
    if resp.status_code == 429:
        return {
            "ok": False,
            "status": "rate_limited",
            "models": None,
            "error": "请求频率限制 (HTTP 429)",
        }
    if resp.status_code >= 500:
        detail = _extract_error_detail(resp)
        return {
            "ok": False,
            "status": "network_error",
            "models": None,
            "error": f"服务端错误 (HTTP {resp.status_code}){detail}",
        }
    if resp.status_code != 200:
        detail = _extract_error_detail(resp)
        return {
            "ok": False,
            "status": "unknown",
            "models": None,
            "error": f"异常响应 (HTTP {resp.status_code}){detail}",
        }

    models = extract_fn(resp)
    return {"ok": True, "status": "ok", "models": models, "error": None}


# ── Vendor-specific probe builders ──────────────────────────────────────────


def _build_probe(
    vendor_id: str, api_key: str, base_url: str
) -> tuple[str | None, dict[str, str], Any]:
    """Return (endpoint_url, headers, response_extractor)."""
    base = base_url.rstrip("/")

    if vendor_id == "openai":
        url = "https://api.openai.com/v1/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        return url, headers, _extract_openai_models

    if vendor_id == "anthropic":
        url = "https://api.anthropic.com/v1/models"
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
        return url, headers, _extract_anthropic_models

    if vendor_id == "deepseek":
        url = f"{base}/v1/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        return url, headers, _extract_openai_models  # OpenAI-compatible

    if vendor_id == "glm":
        # GLM uses OpenAI-compatible endpoint
        url = f"{base}/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        return url, headers, _extract_openai_models

    if vendor_id == "kimi":
        url = f"{base}/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        return url, headers, _extract_openai_models

    if vendor_id == "qwen":
        url = f"{base}/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        return url, headers, _extract_openai_models

    if vendor_id == "ollama":
        url = "http://localhost:11434/api/tags"
        # When base_url differs from default, honour it
        if "localhost" not in base and base != "http://localhost:11434":
            url = f"{base}/api/tags"
        headers = {}
        return url, headers, _extract_ollama_models

    if vendor_id == "openai-compat":
        url = f"{base}/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        return url, headers, _extract_openai_models

    return None, {}, lambda _: []


# ── Response extractors ────────────────────────────────────────────────────


def _extract_openai_models(resp: httpx.Response) -> list[str]:
    """Extract model IDs from OpenAI-compatible /models response."""
    try:
        data = resp.json()
        return [
            m["id"] for m in data.get("data", []) if isinstance(m, dict) and m.get("id")
        ]
    except (KeyError, TypeError, ValueError):
        return []


def _extract_anthropic_models(resp: httpx.Response) -> list[str]:
    """Extract model IDs from Anthropic /v1/models response."""
    try:
        data = resp.json()
        return [
            m["id"] for m in data.get("data", []) if isinstance(m, dict) and m.get("id")
        ]
    except (KeyError, TypeError, ValueError):
        return []


def _extract_error_detail(resp: httpx.Response) -> str:
    """Extract a human-readable detail snippet from an error response."""
    try:
        body = resp.json()
        msg = (
            body.get("error", {}).get("message", "")
            or body.get("message", "")
            or body.get("error", "")
        )
        if isinstance(msg, str) and msg.strip():
            return f" — {msg.strip()[:120]}"
    except (ValueError, TypeError, AttributeError):
        pass
    return ""


def _extract_ollama_models(resp: httpx.Response) -> list[str]:
    """Extract model names from Ollama /api/tags response."""
    try:
        data = resp.json()
        return [
            m["name"]
            for m in data.get("models", [])
            if isinstance(m, dict) and m.get("name")
        ]
    except (KeyError, TypeError, ValueError):
        return []
