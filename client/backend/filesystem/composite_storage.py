"""CompositeStorageBackend — 组合路由后端（ADR-001）。

按 PATH_TO_KEY 把 settings 路径路由到 DatabaseFileBackend，其余路径
（volumes/chapters/prompts/archives/threads/md 等）路由 LocalFileBackend。
唯一属主非镜像 → 运行时无双写、无一致性问题；仅启动迁移存在一次性 file→DB 窗口。
本模块只做路由分派，不含 DB IO（DB 读写都在 db_storage）。
"""

from filesystem.db_storage import DatabaseFileBackend, seed_settings_to_db
from filesystem.paths import is_character_dir, route_relative_path
from filesystem.storage import LocalFileBackend


class CompositeStorageBackend:
    def __init__(self) -> None:
        self._db = DatabaseFileBackend()
        self._local = LocalFileBackend()

    async def read_yaml(self, root_path: str, relative_path: str) -> dict:
        if route_relative_path(relative_path) is not None:
            return await self._db.read_yaml(root_path, relative_path)
        return await self._local.read_yaml(root_path, relative_path)

    async def write_yaml(self, root_path: str, relative_path: str, data: dict) -> None:
        if route_relative_path(relative_path) is not None:
            await self._db.write_yaml(root_path, relative_path, data)
        else:
            await self._local.write_yaml(root_path, relative_path, data)

    async def read_md(self, root_path: str, relative_path: str) -> str:
        # md 无设定，显式走 file（坑3）
        return await self._local.read_md(root_path, relative_path)

    async def write_md(self, root_path: str, relative_path: str, content: str) -> None:
        await self._local.write_md(root_path, relative_path, content)

    async def delete_file(self, root_path: str, relative_path: str) -> None:
        if route_relative_path(relative_path) is not None:
            await self._db.delete_file(root_path, relative_path)
        else:
            await self._local.delete_file(root_path, relative_path)

    async def list_dir(self, root_path: str, relative_path: str = "") -> list[str]:
        if is_character_dir(relative_path):
            return await self._db.list_dir(root_path, relative_path)
        return await self._local.list_dir(root_path, relative_path)

    async def init_skeleton(self, root_path: str) -> None:
        # ADR-003：settings 模板只进 DB 不进盘；本地骨架含非设定文件
        await seed_settings_to_db(root_path)
        await self._local.init_skeleton(root_path)

    async def delete_root(self, root_path: str) -> None:
        await self._db.delete_root(root_path)  # 先清行，再 rmtree（坑4）
        await self._local.delete_root(root_path)
