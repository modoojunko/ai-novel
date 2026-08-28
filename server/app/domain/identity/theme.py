"""界面主题目录：key 白名单单一事实源（theme-preferences 契约）。

前端 CSS 覆盖层（两端 base.css @cross 段）、API 白名单校验、
docs/ux 色相登记簿三处以本表为准；扩容 = 双端同批 + 登记簿同批。
默认 = 空串 / "teal"（无 data-theme 属性，令牌基础值即 teal）。
"""
from __future__ import annotations

DEFAULT_THEME = ""

# 顺序即选择器展示顺序
ALLOWED_THEMES: tuple[str, ...] = (
    "teal",      # 默认（等价空串：不设 data-theme）
    "ink",       # 玄墨
    "bamboo",    # 竹青
    "rouge",     # 胭脂
    "wisteria",  # 紫藤
    "celadon",   # 青瓷
)


def normalize_theme(raw: str | None) -> str:
    """外部输入归一：None→默认；teal 视为「未设置」存空串（保持库内单一默认表示）。"""
    if raw == "teal":
        return DEFAULT_THEME
    return raw or DEFAULT_THEME


def is_valid_theme(raw: str | None) -> bool:
    return (raw or DEFAULT_THEME) in ALLOWED_THEMES
