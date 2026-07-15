from filesystem.storage import get_storage


async def build_project_tree(project_id: str, root_path: str) -> dict:
    """Build the full project tree: settings + volumes + chapters with status."""
    storage = get_storage()

    # Volumes
    files = await storage.list_dir(root_path, "volumes")
    volumes = []
    for f in sorted(files):
        if f.endswith(".yaml"):
            data = await storage.read_yaml(root_path, f"volumes/{f}")
            chapters = []
            for ch in data.get("chapters") or []:
                chapters.append(
                    {
                        "ref": f"vol-{ch['volume']}-ch-{ch['chapter']}",
                        "volume": ch.get("volume"),
                        "chapter": ch.get("chapter"),
                        "title": ch.get("title", ""),
                        "status": ch.get("status", "outline"),
                        "word_count": len(ch.get("prose", "")),
                    }
                )
            volumes.append(
                {
                    "ref": f.replace(".yaml", ""),
                    "title": data.get("title", f),
                    "summary": data.get("summary", ""),
                    "chapter_count": len(chapters),
                    "chapters": chapters,
                }
            )

    return {
        "project_id": project_id,
        "volumes": volumes,
    }
