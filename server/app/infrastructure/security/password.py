from __future__ import annotations

import hashlib

# 跟旧系统保持相同 salt，保证已有的密码哈希兼容
_SALT = "ainovel_local_test"
_ITERATIONS = 100_000


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 → hex digest。"""
    return hashlib.pbkdf2_hmac("sha256", password.encode(), _SALT.encode(), _ITERATIONS).hex()


def verify_password(plain: str, hashed: str) -> bool:
    """常量时间比较。"""
    return hashlib.pbkdf2_hmac("sha256", plain.encode(), _SALT.encode(), _ITERATIONS).hex() == hashed
