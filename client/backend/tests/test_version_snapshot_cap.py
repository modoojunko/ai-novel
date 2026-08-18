"""批次一 — 版本快照每章上限（MAX_VERSIONS_PER_CHAPTER = 50）

编辑器 1.5s 防抖自动保存每次内容变更都会写一份快照，不设上限会随写作
时长线性膨胀。本测试直接打 workflow.engine.save_chapter（所有写路径的
快照唯一入口：/prose 自动保存、全量 PUT、restore、AI 写作）。

用法：
    cd client/backend
    python -m pytest tests/test_version_snapshot_cap.py -v
"""

import time as _time

import pytest

from filesystem.storage import LocalFileBackend
from workflow import engine
from workflow.engine import MAX_VERSIONS_PER_CHAPTER, save_chapter


@pytest.fixture
def backend(tmp_path, monkeypatch):
    """engine.save_chapter 打到本地文件后端 + tmp 根目录（隔离 DATA_ROOT）。"""
    b = LocalFileBackend()
    root = str(tmp_path)
    monkeypatch.setattr(engine, "get_storage", lambda: b)
    return b, root


def _fake_clock(monkeypatch):
    """每次调用 +1s：保证快照文件名 v{ms} 唯一（同毫秒会覆盖同名文件）。"""
    tick = [1_700_000_000.0]

    def _now():
        tick[0] += 1.0
        return tick[0]

    monkeypatch.setattr(_time, "time", _now)
    return tick


async def _save_n(b, root, n: int):
    """初始建章 + n 次内容变更保存。"""
    chapter = {"volume": 1, "chapter": 1, "title": "第1章", "prose": ""}
    await b.write_yaml(root, "chapters/vol-1-ch-1.yaml", chapter)
    for i in range(n):
        chapter = {**chapter, "prose": f"第 {i} 版正文" + "字" * 100}
        await save_chapter(root, "vol-1-ch-1", chapter)


class TestVersionSnapshotCap:
    @pytest.mark.asyncio
    async def test_cap_keeps_latest_50(self, backend, monkeypatch):
        b, root = backend
        _fake_clock(monkeypatch)

        # 60 次变更 → 无上限应产生 60 份快照，上限后只剩最近 50 份
        await _save_n(b, root, 60)

        files = sorted(
            f
            for f in await b.list_dir(root, "versions/vol-1-ch-1")
            if f.endswith(".yaml")
        )
        assert len(files) == MAX_VERSIONS_PER_CHAPTER
        # 最旧的 10 份（第 0-9 次变更）被清掉，最新一份在场
        oldest_kept = files[0].removesuffix(".yaml")
        assert oldest_kept != "v1700000001000"  # 第一次变更的时间戳已被删
        newest = files[-1].removesuffix(".yaml")
        assert newest == "v1700000060000"  # 第 60 次变更（tick 起始 +60s）

    @pytest.mark.asyncio
    async def test_under_cap_keeps_all(self, backend, monkeypatch):
        b, root = backend
        _fake_clock(monkeypatch)

        await _save_n(b, root, 10)

        files = [
            f
            for f in await b.list_dir(root, "versions/vol-1-ch-1")
            if f.endswith(".yaml")
        ]
        assert len(files) == 10

    @pytest.mark.asyncio
    async def test_unchanged_content_no_snapshot(self, backend, monkeypatch):
        b, root = backend
        _fake_clock(monkeypatch)

        chapter = {"volume": 1, "chapter": 1, "title": "第1章", "prose": "同样内容"}
        await b.write_yaml(root, "chapters/vol-1-ch-1.yaml", chapter)
        # 内容未变 → 不产生新快照
        await save_chapter(root, "vol-1-ch-1", {**chapter})
        files = await b.list_dir(root, "versions/vol-1-ch-1")
        assert files == []

    def test_cap_constant(self):
        # 契约：上限值稳定（前端版本列表依赖后端有界返回）
        assert MAX_VERSIONS_PER_CHAPTER == 50
        assert callable(engine.save_chapter)
