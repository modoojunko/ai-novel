"""chapter_prompts 表持久化回环测试（PR④ 数据全量入库）。

覆盖：assemble_all_segments 生成 → DB 行（seg-N-prompt）+ 对外路径形态；
save_prompt/load_prompt 读写回环 + upsert 覆写；HTTP 列表/读取/编辑三端点。
文件形态 {ref}-{name}.md 由派生保持（前端零改动），不再落盘。

用法：
    cd client/backend
    python -m pytest tests/test_prompt_store_db.py -v
"""

import asyncio
import os
import tempfile

_tmp_db = tempfile.NamedTemporaryFile(suffix="_prompt_db.db", delete=False)  # noqa: SIM115
_tmp_db.close()
_tmp_data_root = tempfile.mkdtemp(prefix="test_prompt_store_db_")

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp_db.name}"
os.environ["DATA_ROOT"] = _tmp_data_root

from conftest import seed_chapter_db
from sqlalchemy import select

from db import Base, async_session, engine
from filesystem.storage import get_storage
from models.archive import ChapterPrompt
from models.chapter import Chapter
from models.project import Novel
from prompt.assembler import assemble_all_segments
from prompt.store import load_prompt, save_prompt


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


_CHAPTER = {
    "volume": 1,
    "chapter": 1,
    "title": "第一章",
    "outline": {"summary": "主角来到边境城邦。", "characters": ["张三"]},
    "memo": {},
    "segments": [
        {"summary": "城门初见城邦", "target_words": 800},
        {"summary": "遇到神秘商人", "target_words": 1200},
    ],
}


def _seed(root: str) -> None:
    _run_async(
        get_storage().write_yaml(
            root,
            "settings/writing-style.yaml",
            {"role": "一位小说家", "core_principles": "", "possible_mistakes": ""},
        )
    )
    _run_async(
        get_storage().write_yaml(
            root, "settings/anti-ai.yaml", {"fatigue_words_zh": {}, "structural_tic_patterns": []}
        )
    )
    _run_async(seed_chapter_db(root, _CHAPTER))


async def _prompt_rows(root: str) -> list[ChapterPrompt]:
    async with async_session() as session:
        stmt = (
            select(ChapterPrompt)
            .join(Chapter, Chapter.id == ChapterPrompt.chapter_id)
            .join(Novel, Novel.id == Chapter.project_id)
            .where(Novel.root_path == root)
            .order_by(ChapterPrompt.name)
        )
        return (await session.scalars(stmt)).all()


def test_assemble_all_segments_persists_rows():
    root = tempfile.mkdtemp(prefix="psdb1_")
    _seed(root)

    paths = _run_async(assemble_all_segments(root, "vol-1-ch-1", "测试小说"))

    # 对外路径形态保持（前端零改动）
    assert paths == [
        "prompts/vol-1-ch-1-seg-1-prompt.md",
        "prompts/vol-1-ch-1-seg-2-prompt.md",
    ]
    rows = _run_async(_prompt_rows(root))
    assert [r.name for r in rows] == ["seg-1-prompt", "seg-2-prompt"]
    assert all("城门" in rows[0].content or rows[0].content for r in rows)
    assert rows[0].content, "提示词全文应入库"
    # 不再落盘
    assert _run_async(get_storage().list_dir(root, "prompts")) == []


def test_save_and_load_prompt_upsert():
    root = tempfile.mkdtemp(prefix="psdb2_")
    _seed(root)

    assert _run_async(load_prompt(root, "vol-1-ch-1", "write-prompt")) == ""
    _run_async(save_prompt(root, "vol-1-ch-1", "write-prompt", "写作提示词 V1"))
    assert _run_async(load_prompt(root, "vol-1-ch-1", "write-prompt")) == "写作提示词 V1"
    # 同名覆写（upsert 不重复建行）
    _run_async(save_prompt(root, "vol-1-ch-1", "write-prompt", "写作提示词 V2"))
    rows = _run_async(_prompt_rows(root))
    assert len(rows) == 1
    assert rows[0].content == "写作提示词 V2"


def test_save_prompt_missing_chapter_silent():
    root = tempfile.mkdtemp(prefix="psdb3_")
    # 不种章行：对齐文件时代不抛错
    _run_async(save_prompt(root, "vol-9-ch-9", "write-prompt", "孤儿"))
    assert _run_async(_prompt_rows(root)) == []


# ── HTTP 层：list / get / put 三端点 ───────────────────────────────────────


import uuid

import pytest
from fastapi.testclient import TestClient

from auth_local.deps import require_ai_access, require_project_limit
from auth_local.middleware import get_current_user
from db import get_db
from main import app
from models.user import User


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
    _run_async(_create_user("psdb_user"))
    yield


async def _override_get_db():
    async with async_session() as session:
        yield session


async def _override_current_user():
    return {"id": "psdb_user"}


async def _override_true():
    return True


@pytest.fixture(autouse=True)
def _setup_overrides():
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[require_project_limit] = _override_true
    app.dependency_overrides[require_ai_access] = _override_true
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestPromptHTTPEndpoints:
    def test_generate_list_get_put_roundtrip(self, client):
        # 建项目 + 卷 + 章（HTTP 正规链路）
        name = f"psdb-{uuid.uuid4().hex[:6]}"
        r = client.post("/api/novels", json={"name": name})
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]
        client.put(
            f"/api/novels/{pid}/settings/world",
            json={"geography": {"scenes": "g"}, "politics": {}, "rules": {}},
        )
        r2 = client.post(f"/api/novels/{pid}/volumes", json={"title": "第一卷"})
        assert r2.status_code in (200, 201), r2.text
        r3 = client.post(
            f"/api/novels/{pid}/volumes/vol-1/chapters", json={"title": "第一章"}
        )
        assert r3.status_code in (200, 201), r3.text
        ref = r3.json()["ref"]

        # 大纲带两段（生成提示词的前置）
        outline = client.get(f"/api/novels/{pid}/chapters/{ref}").json()
        outline.setdefault("segments", [])
        outline["segments"] = [
            {"summary": "城门初见", "target_words": 800},
            {"summary": "遇到商人", "target_words": 1200},
        ]
        r4 = client.put(f"/api/novels/{pid}/chapters/{ref}", json=outline)
        assert r4.status_code == 200, r4.text

        # 生成 → DB 行 + 对外路径形态
        r5 = client.post(f"/api/novels/{pid}/chapters/{ref}/prompts/generate")
        assert r5.status_code == 200, r5.text
        assert r5.json()["prompts"] == [
            f"prompts/{ref}-seg-1-prompt.md",
            f"prompts/{ref}-seg-2-prompt.md",
        ]

        # 列表 → 文件名形态
        r6 = client.get(f"/api/novels/{pid}/chapters/{ref}/prompts")
        assert r6.status_code == 200, r6.text
        assert sorted(r6.json()) == [
            f"{ref}-seg-1-prompt.md",
            f"{ref}-seg-2-prompt.md",
        ]

        # 读取 → PlainText 全文
        r7 = client.get(f"/api/novels/{pid}/chapters/{ref}/prompts/seg-1")
        assert r7.status_code == 200, r7.text
        assert "城门初见" in r7.text

        # 编辑 → upsert 覆写
        r8 = client.put(
            f"/api/novels/{pid}/chapters/{ref}/prompts/seg-1",
            json={"content": "手改后的提示词"},
        )
        assert r8.status_code == 200, r8.text
        r9 = client.get(f"/api/novels/{pid}/chapters/{ref}/prompts/seg-1")
        assert r9.text == "手改后的提示词"

        # 缺失 → 空文本 200（对齐 read_md 缺文件）
        r10 = client.get(f"/api/novels/{pid}/chapters/{ref}/prompts/seg-9")
        assert r10.status_code == 200, r10.text
        assert r10.text == ""
