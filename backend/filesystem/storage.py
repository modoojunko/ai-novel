import os
from pathlib import Path
from typing import Protocol

import yaml
from sqlalchemy import text

from config import STORAGE_BACKEND


# --- Protocol ---


class StorageBackend(Protocol):
    async def read_yaml(self, root_path: str, relative_path: str) -> dict: ...
    async def write_yaml(
        self, root_path: str, relative_path: str, data: dict
    ) -> None: ...
    async def read_md(self, root_path: str, relative_path: str) -> str: ...
    async def write_md(
        self, root_path: str, relative_path: str, content: str
    ) -> None: ...
    async def list_dir(self, root_path: str, relative_path: str) -> list[str]: ...
    async def init_skeleton(self, root_path: str) -> None: ...


# --- Local filesystem backend ---


class LocalFileBackend:
    @staticmethod
    def _safe_path(root_path: str, relative_path: str) -> str:
        resolved = os.path.normpath(os.path.join(root_path, relative_path))
        root = os.path.normpath(root_path)
        if not resolved.startswith(root + os.sep) and resolved != root:
            raise ValueError("Path traversal detected")
        return resolved

    async def read_yaml(self, root_path: str, relative_path: str) -> dict:
        filepath = self._safe_path(root_path, relative_path)
        if not os.path.exists(filepath):
            return {}
        with open(filepath, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    async def write_yaml(self, root_path: str, relative_path: str, data: dict) -> None:
        filepath = self._safe_path(root_path, relative_path)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            yaml.dump(
                data, f, allow_unicode=True, default_flow_style=False, sort_keys=False
            )

    async def read_md(self, root_path: str, relative_path: str) -> str:
        filepath = self._safe_path(root_path, relative_path)
        if not os.path.exists(filepath):
            return ""
        return Path(filepath).read_text(encoding="utf-8")

    async def write_md(self, root_path: str, relative_path: str, content: str) -> None:
        filepath = self._safe_path(root_path, relative_path)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        Path(filepath).write_text(content, encoding="utf-8")

    async def list_dir(self, root_path: str, relative_path: str = "") -> list[str]:
        dirpath = (
            self._safe_path(root_path, relative_path) if relative_path else root_path
        )
        if not os.path.exists(dirpath):
            return []
        return os.listdir(dirpath)

    async def init_skeleton(self, root_path: str) -> None:
        from filesystem.init import _init_project_skeleton_local

        _init_project_skeleton_local(root_path)


# --- Database backend (CloudBase MySQL) ---


class DatabaseFileBackend:
    def __init__(self, session_factory):
        self._sf = session_factory

    @staticmethod
    def _parse_root(root_path: str) -> tuple[str, str]:
        parts = root_path.rstrip("/").split("/")
        return parts[-2], parts[-1]

    async def read_yaml(self, root_path: str, relative_path: str) -> dict:
        user_id, slug = self._parse_root(root_path)
        async with self._sf() as session:
            result = await session.execute(
                text(
                    "SELECT content FROM novel_files "
                    "WHERE user_id=:uid AND project_slug=:slug "
                    "AND file_path=:fp AND content_type='yaml'"
                ),
                {"uid": user_id, "slug": slug, "fp": relative_path},
            )
            row = result.fetchone()
            return yaml.safe_load(row[0]) if row and row[0] else {}

    async def write_yaml(self, root_path: str, relative_path: str, data: dict) -> None:
        user_id, slug = self._parse_root(root_path)
        content = yaml.dump(
            data, allow_unicode=True, default_flow_style=False, sort_keys=False
        )
        async with self._sf() as session:
            await session.execute(
                text(
                    "INSERT INTO novel_files (user_id, project_slug, file_path, content, content_type) "
                    "VALUES (:uid, :slug, :fp, :content, 'yaml') "
                    "ON DUPLICATE KEY UPDATE content=VALUES(content)"
                ),
                {"uid": user_id, "slug": slug, "fp": relative_path, "content": content},
            )
            await session.commit()

    async def read_md(self, root_path: str, relative_path: str) -> str:
        user_id, slug = self._parse_root(root_path)
        async with self._sf() as session:
            result = await session.execute(
                text(
                    "SELECT content FROM novel_files "
                    "WHERE user_id=:uid AND project_slug=:slug "
                    "AND file_path=:fp AND content_type='md'"
                ),
                {"uid": user_id, "slug": slug, "fp": relative_path},
            )
            row = result.fetchone()
            return row[0] if row else ""

    async def write_md(self, root_path: str, relative_path: str, content: str) -> None:
        user_id, slug = self._parse_root(root_path)
        async with self._sf() as session:
            await session.execute(
                text(
                    "INSERT INTO novel_files (user_id, project_slug, file_path, content, content_type) "
                    "VALUES (:uid, :slug, :fp, :content, 'md') "
                    "ON DUPLICATE KEY UPDATE content=VALUES(content)"
                ),
                {"uid": user_id, "slug": slug, "fp": relative_path, "content": content},
            )
            await session.commit()

    async def list_dir(self, root_path: str, relative_path: str = "") -> list[str]:
        user_id, slug = self._parse_root(root_path)
        prefix = f"{relative_path}/" if relative_path else ""
        async with self._sf() as session:
            result = await session.execute(
                text(
                    "SELECT DISTINCT "
                    "SUBSTRING_INDEX(SUBSTR(file_path, :plen + 1), '/', 1) AS name "
                    "FROM novel_files "
                    "WHERE user_id=:uid AND project_slug=:slug "
                    "AND file_path LIKE CONCAT(:prefix, '%') "
                    "AND file_path != :prefix"
                ),
                {
                    "uid": user_id,
                    "slug": slug,
                    "prefix": prefix,
                    "plen": len(prefix),
                },
            )
            return [r[0] for r in result.fetchall() if r[0]]

    async def init_skeleton(self, root_path: str) -> None:
        from filesystem.init import SKELETON_FILES

        user_id, slug = self._parse_root(root_path)
        for rel_path, content_type in SKELETON_FILES:
            async with self._sf() as session:
                await session.execute(
                    text(
                        "INSERT INTO novel_files (user_id, project_slug, file_path, content, content_type) "
                        "VALUES (:uid, :slug, :fp, '', :ct) "
                        "ON DUPLICATE KEY UPDATE file_path=file_path"
                    ),
                    {"uid": user_id, "slug": slug, "fp": rel_path, "ct": content_type},
                )
                await session.commit()


# --- Singleton factory ---

_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        if STORAGE_BACKEND == "database":
            from db import async_session

            _storage = DatabaseFileBackend(async_session)
        else:
            _storage = LocalFileBackend()
    return _storage
