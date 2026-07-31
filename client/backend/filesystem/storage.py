import os
from pathlib import Path
from typing import Protocol

import yaml

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
    async def delete_file(self, root_path: str, relative_path: str) -> None: ...
    async def list_dir(self, root_path: str, relative_path: str) -> list[str]: ...
    async def init_skeleton(self, root_path: str) -> None: ...
    async def delete_root(self, root_path: str) -> None: ...


# --- Local filesystem backend ---


class LocalFileBackend:
    @staticmethod
    def _safe(resolve: str, relative: str) -> str:
        """标准化路径并检查穿越"""
        r = os.path.normpath(resolve)
        f = os.path.normpath(os.path.join(resolve, relative))
        if not f.startswith(r):
            raise ValueError("Path traversal detected")
        return f

    async def read_yaml(self, root_path: str, relative_path: str) -> dict:
        fullpath = self._safe(root_path, relative_path)
        if not os.path.exists(fullpath):
            return {}
        with open(fullpath, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    async def write_yaml(self, root_path: str, relative_path: str, data: dict) -> None:
        fullpath = self._safe(root_path, relative_path)
        os.makedirs(os.path.dirname(fullpath), exist_ok=True)
        with open(fullpath, "w", encoding="utf-8") as f:
            yaml.dump(
                data, f, allow_unicode=True, default_flow_style=False, sort_keys=False
            )

    async def read_md(self, root_path: str, relative_path: str) -> str:
        fullpath = self._safe(root_path, relative_path)
        if not os.path.exists(fullpath):
            return ""
        return Path(fullpath).read_text(encoding="utf-8")

    async def write_md(self, root_path: str, relative_path: str, content: str) -> None:
        fullpath = self._safe(root_path, relative_path)
        os.makedirs(os.path.dirname(fullpath), exist_ok=True)
        Path(fullpath).write_text(content, encoding="utf-8")

    async def delete_file(self, root_path: str, relative_path: str) -> None:
        fullpath = self._safe(root_path, relative_path)
        if os.path.exists(fullpath):
            os.remove(fullpath)

    async def list_dir(self, root_path: str, relative_path: str = "") -> list[str]:
        if not relative_path:
            dirpath = root_path
        else:
            dirpath = self._safe(root_path, relative_path)
        if not os.path.exists(dirpath):
            return []
        return os.listdir(dirpath)

    async def init_skeleton(self, root_path: str) -> None:
        from filesystem.init import _init_project_skeleton_local

        _init_project_skeleton_local(root_path)

    async def delete_root(self, root_path: str) -> None:
        import shutil

        if os.path.exists(root_path):
            shutil.rmtree(root_path)


_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        _storage = LocalFileBackend()
    return _storage
