"""Connection testing — vendor-specific health check.

This module is a stub. In production it makes real HTTP calls;
in tests, the router layer never invokes it without mocking.
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
