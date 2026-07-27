"""API key encryption using Fernet (symmetric AES-128-CBC with HMAC).

The encryption key is stored at ``{DATA_ROOT}/.fernet_key`` and auto-generated
on first use. This protects API keys at rest in SQLite; the local filesystem
key is considered an acceptable risk for a local desktop app.

If ``DATA_ROOT`` is not writable, encryption falls back to a no-op identity
transform so the app remains functional (the key is stored in plaintext).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from config import DATA_ROOT

_FERNET_KEY_FILE = os.path.join(DATA_ROOT, ".fernet_key")
_fernet: Fernet | None = None
_fallback_plaintext = False


def _get_fernet() -> Fernet | None:
    """Return the Fernet instance, or None if the key file is unavailable."""
    global _fernet, _fallback_plaintext
    if _fernet is not None:
        return _fernet
    if _fallback_plaintext:
        return None

    try:
        # Ensure DATA_ROOT exists
        Path(DATA_ROOT).mkdir(parents=True, exist_ok=True)

        if os.path.isfile(_FERNET_KEY_FILE):
            key = Path(_FERNET_KEY_FILE).read_bytes()
        else:
            key = Fernet.generate_key()
            Path(_FERNET_KEY_FILE).write_bytes(key)
            # Restrict permissions on POSIX
            if sys.platform != "win32":
                os.chmod(_FERNET_KEY_FILE, 0o600)

        _fernet = Fernet(key)
        return _fernet
    except (OSError, PermissionError):
        _fallback_plaintext = True
        return None


def encrypt_api_key(plaintext: str) -> str:
    """Encrypt an API key for storage.

    Returns the encrypted token as a string (prefixed with ``enc:``).
    If encryption is unavailable (key file unwritable), returns the
    plaintext as-is.
    """
    if not plaintext:
        return ""
    f = _get_fernet()
    if f is None:
        return plaintext
    token = f.encrypt(plaintext.encode("utf-8"))
    return "enc:" + token.decode("utf-8")


def decrypt_api_key(stored: str) -> str:
    """Decrypt an API key retrieved from storage.

    Expects a string prefixed with ``enc:`` (produced by ``encrypt_api_key``).
    Unprefixed values are returned as-is (plaintext fallback).
    """
    if not stored:
        return ""
    if not stored.startswith("enc:"):
        return stored  # Plaintext fallback
    f = _get_fernet()
    if f is None:
        # Cannot decrypt — return empty to avoid crashes in callers
        return ""
    try:
        return f.decrypt(stored[4:].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""
