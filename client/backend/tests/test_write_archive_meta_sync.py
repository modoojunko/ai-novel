"""Change 007 — 写/归档路径 DB 元数据同步测试（TE-07）

验证（design.md §测试）：
- archive DB 同步：HTTP 归档 → DB status=archived + archived_at 非空 + 卷 YAML 内嵌列表不写
  + GET /volumes 树 archived=True。
- unarchive 往返：HTTP unarchive → YAML status=draft + 清 archive_path/archive_summary
  + DB archived_at=None + 归档 .md 对称删除 + 树 archived=False。
- 归档过短仍 400（archive 端点字数门限不因双写改动放宽）。
- genre 表面化：选题材 → GET /novels/{id} 响应 genre/genre_name；未选/损坏 KV → None 不 500。

用法：
    cd client/backend
    python -m pytest tests/test_write_archive_meta_sync.py -v
"""

import asyncio
import os
import tempfile
import uuid

import pytest
from fastapi.testclient import TestClient

# ── Test environment (isolated temp DB + data root) ──────────────────────
_tmp_db = tempfile.NamedTemporaryFile(suffix="_wams.db", delete=False)  # noqa: SIM115
_tmp_db.close()
_tmp_data_root = tempfile.mkdtemp(prefix="test_wams_")

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp_db.name}"
os.environ["DATA_ROOT"] = _tmp_data_root

import auth_local.service as _service

_CFG_PATH = os.path.join(_tmp_data_root, "config.json")


def _set_tier(tier: str, api_key: str = ""):
    _service.CONFIG_FILE = _CFG_PATH
    _service.save_local_config({"tier": tier, "expires_at": "", "api_key": api_key})


from auth_local.deps import require_project_limit
from auth_local.middleware import get_current_user
from db import Base, async_session, engine, get_db
from filesystem.storage import get_storage
from main import app
from models import Novel
from models.user import User
from repositories import chapter_repo


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _create_user(user_id: str) -> str:
    async with async_session() as session:
        session.add(
            User(
                id=user_id,
                email=f"{user_id}@test.com",
                password_hash="*",
                display_name=user_id,
            )
        )
        await session.commit()
    return user_id


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    _run_async(_create_tables())
    _run_async(_create_user("wams_user"))
    yield


async def _override_get_db():
    async with async_session() as session:
        yield session


async def _override_current_user():
    return {"id": "wams_user"}


async def _override_true():
    return True


@pytest.fixture(autouse=True)
def _setup_overrides():
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[require_project_limit] = _override_true
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _clean_config_after():
    yield
    if os.path.exists(_CFG_PATH):
        os.remove(_CFG_PATH)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _create_sparse_project(client) -> str:
    name = f"wams-{uuid.uuid4().hex[:6]}"
    r = client.post("/api/novels", json={"name": name})
    assert r.status_code in (200, 201), f"Create failed: {r.text}"
    return r.json()["id"]


def _create_volume_and_chapter(client, pid: str) -> str:
    r = client.post(
        f"/api/novels/{pid}/volumes", json={"vol_num": 1, "title": "Volume 1"}
    )
    assert r.status_code in (200, 201), f"Volume failed: {r.text}"
    r2 = client.post(
        f"/api/novels/{pid}/volumes/{r.json()['ref']}/chapters",
        json={"title": "第1章"},
    )
    assert r2.status_code in (200, 201), f"Chapter failed: {r2.text}"
    return r2.json()["chapter_ref"]


def _chapter_in_tree(tree, ref: str) -> dict:
    for vol in tree:
        for ch in vol.get("chapters", []):
            if ch["ref"] == ref:
                return ch
    raise AssertionError(f"chapter {ref} not in tree: {tree}")


async def _archive_filenames(pid: str) -> list[str]:
    async with async_session() as session:
        proj = await session.get(Novel, pid)
        return await get_storage().list_dir(proj.root_path, "archives")


LONG_TEXT = "（归档正文）灯火在雨里摇晃，她合上日志，决定明日启程。行囊里只有半册旧书，与一枚磨亮的铜哨。" * 20


class TestWriteArchiveMetaSync:
    def test_archive_syncs_db_and_skips_embedded_list(self, client):
        _set_tier("none")
        pid = _create_sparse_project(client)
        ref = _create_volume_and_chapter(client, pid)

        # 归档前：树 archived=False
        tree0 = client.get(f"/api/novels/{pid}/volumes").json()
        assert _chapter_in_tree(tree0, ref)["archived"] is False

        r = client.post(
            f"/api/novels/{pid}/chapters/{ref}/archive", json={"full_text": LONG_TEXT}
        )
        assert r.status_code == 200, r.text

        # DB：status=archived + archived_at 非空；卷 YAML 内嵌列表不写（唯一属主非镜像）
        async def _check():
            async with async_session() as session:
                row = await chapter_repo.get_by_ref(session, pid, ref)
                assert row is not None
                assert row.status == "archived"
                assert row.archived_at is not None
                proj = await session.get(Novel, pid)
                data = await get_storage().read_yaml(
                    proj.root_path, "volumes/vol-1.yaml"
                )
                assert data.get("chapters") == []

        _run_async(_check())

        # 树：archived=True（📦 呈现）
        tree = client.get(f"/api/novels/{pid}/volumes").json()
        assert _chapter_in_tree(tree, ref)["archived"] is True

    def test_unarchive_roundtrip(self, client):
        _set_tier("none")
        pid = _create_sparse_project(client)
        ref = _create_volume_and_chapter(client, pid)
        r = client.post(
            f"/api/novels/{pid}/chapters/{ref}/archive", json={"full_text": LONG_TEXT}
        )
        assert r.status_code == 200, r.text
        assert any(
            f.startswith("vol-1-ch-1-") and f.endswith(".md")
            for f in _run_async(_archive_filenames(pid))
        ), "归档应产生 .md 文件"

        r2 = client.post(f"/api/novels/{pid}/chapters/{ref}/unarchive")
        assert r2.status_code == 200, r2.text
        assert r2.json()["ref"] == ref

        async def _check():
            async with async_session() as session:
                proj = await session.get(Novel, pid)
                # YAML draft + 清归档标记
                data = await get_storage().read_yaml(
                    proj.root_path, f"chapters/{ref}.yaml"
                )
                assert data["status"] == "draft"
                assert "archive_path" not in data
                assert "archive_summary" not in data
                # DB archived_at=None, status=draft
                row = await chapter_repo.get_by_ref(session, pid, ref)
                assert row is not None
                assert row.status == "draft"
                assert row.archived_at is None
                # 归档 .md 对称删除
                mds = await get_storage().list_dir(proj.root_path, "archives")
                assert not any(
                    f.startswith("vol-1-ch-1-") and f.endswith(".md") for f in mds
                )

        _run_async(_check())

        # 树恢复非归档态
        tree = client.get(f"/api/novels/{pid}/volumes").json()
        assert _chapter_in_tree(tree, ref)["archived"] is False

    def test_archive_short_text_still_400(self, client):
        _set_tier("none")
        pid = _create_sparse_project(client)
        ref = _create_volume_and_chapter(client, pid)
        r = client.post(
            f"/api/novels/{pid}/chapters/{ref}/archive", json={"full_text": "太短"}
        )
        assert r.status_code == 400, "过短归档应仍 400"

    def test_genre_surfaced_in_detail(self, client):
        _set_tier("none")
        pid = _create_sparse_project(client)

        # 未选题材 → genre/genre_name None，不 500
        r0 = client.get(f"/api/novels/{pid}")
        assert r0.status_code == 200
        assert r0.json().get("genre") is None
        assert r0.json().get("genre_name") is None

        # 选题材 → 详情合并 genre + 全局 genres 表 name
        r1 = client.put(
            f"/api/novels/{pid}/settings/genre", json={"genre_id": "urban-daily"}
        )
        assert r1.status_code == 200, r1.text
        r2 = client.get(f"/api/novels/{pid}")
        assert r2.status_code == 200
        assert r2.json()["genre"] == "urban-daily"
        assert r2.json()["genre_name"] == "都市日常"

    def test_genre_id_without_definition_name_none(self, client):
        _set_tier("none")
        pid = _create_sparse_project(client)
        # genre_id 已设但定义缺失（被删/未知）→ genre 保留、genre_name None
        r1 = client.put(
            f"/api/novels/{pid}/settings/genre", json={"genre_id": "no-such-genre"}
        )
        assert r1.status_code == 200, r1.text
        r2 = client.get(f"/api/novels/{pid}")
        assert r2.status_code == 200
        assert r2.json()["genre"] == "no-such-genre"
        assert r2.json().get("genre_name") is None

    def test_corrupt_genre_kv_no_500(self, client):
        _set_tier("none")
        pid = _create_sparse_project(client)

        async def _corrupt():
            from models.project_setting import ProjectSetting

            async with async_session() as session:
                proj = await session.get(Novel, pid)
                session.add(
                    ProjectSetting(
                        root_path=proj.root_path, key="genre", content="{bad json"
                    )
                )
                await session.commit()

        _run_async(_corrupt())
        r = client.get(f"/api/novels/{pid}")
        assert r.status_code == 200, "KV 损坏不应 500"
        assert r.json().get("genre") is None
        assert r.json().get("genre_name") is None
