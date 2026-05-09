"""AI client factory — supports Anthropic and DeepSeek (Anthropic-compatible endpoint)."""

from anthropic import AsyncAnthropic

from config import AI_API_KEY, AI_BASE_URL


def create_ai_client() -> AsyncAnthropic:
    kwargs = {"api_key": AI_API_KEY}
    if AI_BASE_URL:
        kwargs["base_url"] = AI_BASE_URL
    return AsyncAnthropic(**kwargs)


def resolve_model(provider_model: str) -> str:
    """Map provider-agnostic names (haiku/sonnet) to actual model IDs."""
    from config import AI_MODEL_MAP

    return AI_MODEL_MAP.get(provider_model, provider_model)
