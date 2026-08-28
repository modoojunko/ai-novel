"""更新用户界面主题偏好（theme-preferences）。

纯校验 + 仓储写入；接口层负责鉴权与响应包装。
非法 key 由调用方（接口层）以 422 拒绝，本层 assert 兜底。
"""
from __future__ import annotations

from app.domain.identity.theme import DEFAULT_THEME, is_valid_theme, normalize_theme
from app.infrastructure.repositories.base import UserRepo


class InvalidThemeError(ValueError):
    """theme key 不在目录白名单内。"""


def update_user_theme(user_repo: UserRepo, username: str, raw_theme: str | None) -> str:
    """校验并持久化主题偏好，返回归一化后的存储值（teal→空串）。"""
    if not is_valid_theme(raw_theme):
        raise InvalidThemeError(f"未知主题：{raw_theme!r}")
    theme = normalize_theme(raw_theme)
    user_repo.update_theme(username, theme)
    return theme


def stored_to_wire(theme: str | None) -> str:
    """库内存储值 → API 出参：空串还原为显式 teal（前端无歧义）。"""
    return "teal" if (theme or DEFAULT_THEME) == DEFAULT_THEME else theme
