import re

from filesystem.reader import read_yaml


def run_quality_checks(
    root_path: str, chapter: dict, full_text: str
) -> dict:
    anti_ai = read_yaml(root_path, "settings/anti-ai.yaml")
    style = read_yaml(root_path, "settings/writing-style.yaml")

    results = {"passed": True, "checks": {}}

    # 1. Anti-AI fatigue words
    fatigue_hits = [
        w for w in anti_ai.get("fatigue_words", []) if w in full_text
    ]
    results["checks"]["fatigue_words"] = {
        "passed": len(fatigue_hits) == 0,
        "hits": fatigue_hits,
    }

    # 2. Forbidden sentence patterns
    pattern_hits = {}
    for p in anti_ai.get("forbidden_patterns", []):
        matches = re.findall(p, full_text)
        if matches:
            pattern_hits[p] = len(matches)
    results["checks"]["forbidden_patterns"] = {
        "passed": len(pattern_hits) == 0,
        "hits": pattern_hits,
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

    # 5. Hook mention check
    hooks_data = read_yaml(root_path, "settings/hooks.yaml")
    chapter_ref = f"vol-{chapter.get('volume')}-ch-{chapter.get('chapter')}"
    chapter_hooks = [
        h
        for h in hooks_data.get("hooks", [])
        if h.get("resolve_plan") == chapter_ref
    ]
    hooks_mentioned = sum(
        1
        for h in chapter_hooks
        if h.get("description", "")[:10] in full_text
    )
    results["checks"]["hook_mentions"] = {
        "passed": (
            hooks_mentioned == len(chapter_hooks) if chapter_hooks else True
        ),
        "expected": len(chapter_hooks),
        "found": hooks_mentioned,
    }

    # 6. Continuity — placeholder
    results["checks"]["continuity"] = {
        "passed": True,
        "note": "skipped in v1",
    }

    results["passed"] = all(
        c["passed"] for c in results["checks"].values()
    )
    return results
