"""AI-powered world-setting prefill."""

from ai_client import get_ai_client
from filesystem.storage import get_storage


WORLD_FIELDS = ["geography", "politics", "culture", "rules", "history"]

from prompts import load as load_prompt


async def prefill_world_setting(root_path: str) -> dict:
    """Generate world-setting based on story synopsis and genre, then write to file."""
    story = await get_storage().read_yaml(root_path, "story.yaml")
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")

    synopsis = story.get("synopsis", "") or story.get("title", "")
    genre = style.get("genre_profile", "urban-daily")
    genre_label = _genre_label(genre)

    if not synopsis:
        return {}

    prompt = load_prompt("prefill_world").format(synopsis=synopsis, genre_label=genre_label)

    client = get_ai_client()
    text = await client.chat(
        model="haiku",
        system="",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=800,
    )

    # Extract JSON
    import json
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        world_data = json.loads(text.strip())
    except json.JSONDecodeError:
        return {}

    # Merge into existing world-setting
    world = await get_storage().read_yaml(root_path, "settings/world-setting.yaml")
    for field in WORLD_FIELDS:
        if field in world_data and world_data[field]:
            world[field] = world_data[field]
    world["_ai_prefilled"] = True
    await get_storage().write_yaml(root_path, "settings/world-setting.yaml", world)

    return world_data


GENRE_LABELS = {
    "suspense-crime": "悬疑刑侦",
    "urban-romance": "都市言情",
    "ancient-politics": "古风权谋",
    "scifi-apocalypse": "科幻末世",
    "xuanhuan": "传统玄幻",
    "xianxia": "东方仙侠",
    "western-fantasy": "西方奇幻",
    "urban-daily": "都市日常",
}


def _genre_label(genre_profile: str) -> str:
    return GENRE_LABELS.get(genre_profile, genre_profile or "都市日常")
