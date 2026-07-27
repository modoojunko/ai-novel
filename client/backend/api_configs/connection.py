"""Connection testing — vendor-specific health check.

TODO: This module is a stub. The router endpoints
`POST /api/v1/api-configs/{config_id}/test` and
`POST /api/v1/api-configs/{config_id}/refresh-models` in
api_configs/router.py currently return hardcoded stub responses
instead of calling this function.

To implement: dispatch to vendor-specific HTTP health-check
functions (e.g. Anthropic: GET /models, OpenAI: GET /models,
Ollama: GET /api/tags) and parse the response to extract available
model IDs. Each vendor function should handle auth failures,
timeouts, and network errors gracefully.
"""

from __future__ import annotations

import os
from typing import Any

CONNECTION_TEST_TIMEOUT = int(os.environ.get("API_CONFIG_TEST_TIMEOUT", "5"))


async def test_connection(
    vendor_id: str,
    api_key: str,
    base_url: str,
    timeout: int = CONNECTION_TEST_TIMEOUT,
) -> dict[str, Any]:
    """Test connectivity to a vendor's API.

    Returns a dict with at least:
        {"ok": bool, "status": str, "models": list[str] | None}
    """
    # Stub — returns timeout to indicate no real connection was available.
    # Production code would dispatch to vendor-specific test functions.
    return {"ok": False, "status": "network_error", "models": None}
