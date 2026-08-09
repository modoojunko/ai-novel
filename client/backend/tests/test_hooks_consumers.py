"""hooks 消费端与前端 active 结构对齐的回归测试。

回归 bug：前端保存 hooks.yaml 为 {active, resolved, abandoned}，但
prompt/context.inject_active_hooks 与 archive/service.update_thread_state 此前
按旧结构读 hooks["hooks"] → 写正文注入不到伏笔、归档不标记 mentioned。
另修 introduced_in 短格式（"1-1"）与规范 vol-N-ch-M 不匹配的问题。
"""

import asyncio
import tempfile

from archive.service import update_thread_state
from filesystem.storage import get_storage
from prompt.context import inject_active_hooks


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _tmp_root() -> str:
    return tempfile.mkdtemp(prefix="test_hooks_consumers_")


def _write_hooks(root: str, active: list, resolved=None, abandoned=None):
    data = {"active": active, "resolved": resolved or [], "abandoned": abandoned or []}
    _run_async(get_storage().write_yaml(root, "settings/hooks.yaml", data))


# ── prompt/context.inject_active_hooks ────────────────────────────────────


class TestInjectActiveHooks:
    def test_injects_frontend_style_active_hook(self):
        """前端项（description/introduced_in，无 id/status）应注入提示词。"""
        root = _tmp_root()
        _write_hooks(root, [{"description": "主角妹妹失踪的真相", "introduced_in": "1-1"}])
        out = _run_async(inject_active_hooks(root, "vol-2-ch-1"))
        assert "## 当前悬而未决的伏笔" in out
        assert "主角妹妹失踪的真相" in out

    def test_excludes_hook_introduced_in_current_chapter(self):
        root = _tmp_root()
        _write_hooks(root, [{"description": "本章新埋的钩子", "introduced_in": "vol-2-ch-1"}])
        assert _run_async(inject_active_hooks(root, "vol-2-ch-1")) == ""

    def test_short_form_introduced_in_matches_canonical_current_chapter(self):
        """短格式 "1-2" == vol-1-ch-2，当前章引入的钩子不注入。"""
        root = _tmp_root()
        _write_hooks(root, [{"description": "1-2 引入", "introduced_in": "1-2"}])
        assert _run_async(inject_active_hooks(root, "vol-1-ch-2")) == ""

    def test_only_active_list_is_read(self):
        """旧结构 hooks 键与 resolved/abandoned 不应被消费。"""
        root = _tmp_root()
        _write_hooks(
            root,
            active=[],
            resolved=[{"description": "已收束的钩子"}],
            abandoned=[{"description": "废弃的钩子"}],
        )
        assert _run_async(inject_active_hooks(root, "vol-1-ch-1")) == ""
        # 旧结构 hooks 键：数据模型已统一为 active，读不到 → 空
        _run_async(
            get_storage().write_yaml(
                root, "settings/hooks.yaml", {"hooks": [{"description": "旧格式"}]}
            )
        )
        assert _run_async(inject_active_hooks(root, "vol-1-ch-1")) == ""

    def test_missing_hooks_file_returns_empty(self):
        root = _tmp_root()
        assert _run_async(inject_active_hooks(root, "vol-1-ch-1")) == ""


# ── archive/service.update_thread_state 标记 mentioned ────────────────────


class TestUpdateThreadState:
    def test_marks_active_hook_as_mentioned_by_short_form_ref(self):
        """归档 vol-1-ch-1 时，active 中 introduced_in "1-1" 的钩子标记 mentioned。"""
        root = _tmp_root()
        _write_hooks(root, [{"description": "第一章引入", "introduced_in": "1-1"}])
        _run_async(
            update_thread_state(root, {"volume": 1, "chapter": 1, "thread": "主线"}, "摘要")
        )
        data = _run_async(get_storage().read_yaml(root, "settings/hooks.yaml"))
        assert data["active"][0]["status"] == "mentioned"
        # 三表结构原样保留
        assert set(data) == {"active", "resolved", "abandoned"}

    def test_does_not_mark_other_chapters_hook(self):
        root = _tmp_root()
        _write_hooks(root, [{"description": "另一章引入", "introduced_in": "1-2"}])
        _run_async(
            update_thread_state(root, {"volume": 1, "chapter": 1, "thread": "主线"}, "摘要")
        )
        data = _run_async(get_storage().read_yaml(root, "settings/hooks.yaml"))
        assert "status" not in data["active"][0]

    def test_missing_hooks_file_does_not_crash(self):
        root = _tmp_root()
        _run_async(update_thread_state(root, {"volume": 1, "chapter": 1}, "摘要"))
        data = _run_async(get_storage().read_yaml(root, "settings/hooks.yaml"))
        assert data == {}
