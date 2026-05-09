"""AI-powered world-setting prefill."""

from ai_client import get_ai_client
from filesystem.storage import get_storage


WORLD_FIELDS = ["geography", "politics", "culture", "rules", "history"]

WORLD_PROMPT = """你是一位资深类型小说设定师。根据下面的小说简介和类型，为这本小说的世界写一份设定草稿。每个字段 2-4 句话，用大白话写，不要文学评论腔。

小说简介：{synopsis}
小说类型：{genre_label}

为以下每个字段写一段设定：
- geography：地理环境——这个世界长什么样。城市？荒野？异世界？什么年代？
- politics：权力结构——谁掌权？有什么组织、势力？普通人怎么生活？
- culture：文化氛围——人们的价值观、日常习惯。有什么特别的习俗或禁忌？
- rules：特殊规则——这个世界有什么不同？魔法？科技？特殊法则？（没有就写"无特殊规则"）
- history：关键背景——有什么过去的事件影响了当前的局势？

用 JSON 格式返回（不要额外文本）：
{{
  "geography": "...",
  "politics": "...",
  "culture": "...",
  "rules": "...",
  "history": "..."
}}

要求：
- 紧密围绕小说简介展开，不要编造无关内容
- 给后续写作留空间——设定是指引，不是束缚
- 语言像编辑在跟作者聊设定，不是百科全书"""


async def prefill_world_setting(root_path: str) -> dict:
    """Generate world-setting based on story synopsis and genre, then write to file."""
    story = await get_storage().read_yaml(root_path, "story.yaml")
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")

    synopsis = story.get("synopsis", "") or story.get("title", "")
    genre = style.get("genre_profile", "urban-daily")
    genre_label = _genre_label(genre)

    if not synopsis:
        return {}

    prompt = WORLD_PROMPT.format(synopsis=synopsis, genre_label=genre_label)

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
