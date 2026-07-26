"""Genre knowledge base — reads genre-corpus YAML files and serves genre metadata.

Provides two endpoints:
  GET /api/genres          — list all available genres with metadata
  GET /api/genres/{id}     — full genre data
"""

from pathlib import Path

import yaml
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/genres", tags=["genres"])

# Locate genre-corpus directory relative to this file
_GENRE_DIR = Path(__file__).parent.parent.parent / "reference" / "genre-corpus"


def _load_all_genres() -> dict:
    """Load all genre YAML files from genre-corpus directory."""
    genres = {}
    if not _GENRE_DIR.is_dir():
        return genres
    for f in sorted(_GENRE_DIR.glob("*.yaml")):
        try:
            with open(f, "r", encoding="utf-8") as fh:
                data = yaml.safe_load(fh)
            if data and data.get("id"):
                genres[data["id"]] = data
        except (OSError, yaml.YAMLError):
            pass
    return genres


def _genre_summary(data: dict) -> dict:
    """Return a lightweight summary for listing."""
    return {
        "id": data.get("id", ""),
        "label": data.get("label", ""),
        "description": data.get("description", ""),
        "category": data.get("category", ""),
    }


@router.get("")
async def list_genres():
    """Return all available genres (lightweight metadata)."""
    genres = _load_all_genres()
    return [{"category": cat, "genres": items} for cat, items in _group_by_category(genres)]


@router.get("/{genre_id}")
async def get_genre(genre_id: str):
    """Return full genre data for a specific genre ID."""
    genres = _load_all_genres()
    data = genres.get(genre_id)
    if not data:
        return JSONResponse(status_code=404, content={"detail": "Genre not found"})
    return data


def _group_by_category(genres: dict) -> list[tuple[str, list[dict]]]:
    """Group genres by category for structured listing."""
    from collections import OrderedDict

    grouped: OrderedDict[str, list[dict]] = OrderedDict()
    for g in genres.values():
        cat = g.get("category", "其他")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(_genre_summary(g))
    return list(grouped.items())
