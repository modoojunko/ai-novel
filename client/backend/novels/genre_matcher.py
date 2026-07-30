"""免费导入辅助：关键词匹配类型检测（非 AI）。"""

import json
from pathlib import Path

_DATA: dict | None = None


def _load_data() -> dict:
    global _DATA
    if _DATA is not None:
        return _DATA
    path = Path(__file__).parent / "genre_keywords.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            _DATA = json.load(f)
    else:
        _DATA = {}
    return _DATA


def match_genre(text: str) -> tuple[str | None, float]:
    """对正文进行关键词匹配，返回 (genre_name | None, confidence)。

    confidence 范围为 0-1，基于关键词命中数与权重的综合得分。
    返回置信度最高的类型，若无匹配返回 (None, 0.0)。
    """
    data = _load_data()
    if not text or not data:
        return None, 0.0

    scores: dict[str, int] = {}
    for genre, config in data.items():
        weight = config.get("weight", 1)
        keywords = config.get("keywords", [])
        score = 0
        for kw in keywords:
            if kw in text:
                score += weight
        if score > 0:
            scores[genre] = score

    if not scores:
        return None, 0.0

    total_score = sum(scores.values())
    best = max(scores, key=scores.get)
    # confidence = 最高分占总分的比例
    confidence = scores[best] / total_score if total_score > 0 else 0
    return best, min(confidence, 1.0)


def extract_synopsis(text: str, max_chars: int = 300) -> str:
    """从正文开头提取简介。"""
    text = text.strip()
    if not text:
        return ""
    # 取第一个段落（到第一个空行或换行）
    lines = text.split("\n")
    for line in lines:
        line = line.strip()
        if line and len(line) > 10:
            return line[:max_chars]
    return text[:max_chars]
