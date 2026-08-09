import re

from filesystem.storage import get_storage


def _flatten_fatigue_words(anti_ai: dict) -> list[str]:
    """Flatten fatigue_words_zh nested categories into a single list."""
    fw = anti_ai.get("fatigue_words_zh", {})
    words = []
    for category in fw.values():
        if isinstance(category, list):
            words.extend(category)
    return words


async def run_quality_checks(root_path: str, full_text: str) -> dict:
    anti_ai = await get_storage().read_yaml(root_path, "settings/anti-ai.yaml")

    results = {"passed": True, "checks": {}}

    # 1. Anti-AI fatigue words
    fatigue_hits = [w for w in _flatten_fatigue_words(anti_ai) if w in full_text]
    results["checks"]["fatigue_words"] = {
        "passed": len(fatigue_hits) == 0,
        "hits": fatigue_hits,
    }

    # 2. Forbidden sentence patterns
    pattern_hits = {}
    over_threshold = {}
    for p in anti_ai.get("structural_tic_patterns", []):
        pt = p["pattern"] if isinstance(p, dict) else p
        matches = re.findall(pt, full_text)
        if matches:
            name = p.get("name", pt) if isinstance(p, dict) else pt
            pattern_hits[name] = len(matches)
            if len(matches) > p.get("threshold", 3):
                over_threshold[name] = len(matches)
    results["checks"]["structural_tic_patterns"] = {
        "passed": len(pattern_hits) == 0,
        "hits": pattern_hits,
        "over_threshold": over_threshold,
    }

    # 3. Dialogue ratio
    dialogue_chars = 0
    for m in re.finditer(r'[""“”「」]([^""“”「」]*?)[""“”「」]', full_text):
        dialogue_chars += len(m.group(1))
    total = len(full_text.replace("\n", "").replace(" ", ""))
    dialogue_ratio = dialogue_chars / total if total > 0 else 0
    results["checks"]["dialogue_ratio"] = {
        "passed": 0.05 <= dialogue_ratio <= 0.7,
        "value": round(dialogue_ratio, 3),
    }

    # 4. Description ratio
    env_hits = len(
        re.findall(
            r"(天[空气]|阳光|风|雨|雪|灯|暗|影|气味|声音|温度|寒冷|炎热|潮湿)",
            full_text,
        )
    )
    desc_estimate = env_hits * 30 / total if total > 0 else 0
    results["checks"]["description_ratio"] = {
        "passed": desc_estimate > 0.03,
        "value": round(desc_estimate, 3),
    }

    # 5. Continuity — placeholder
    results["checks"]["continuity"] = {
        "passed": True,
        "note": "skipped in v1",
    }

    results["passed"] = all(c["passed"] for c in results["checks"].values())
    return results
