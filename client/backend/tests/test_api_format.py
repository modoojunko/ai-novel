"""接口格式（api_format）测试：迁移等价回填 / 显式协议优先 / 按协议探测 / 契约与 update 语义 / 备份加键 roundtrip。

Usage:
    cd client/backend && .venv/bin/python -m pytest tests/test_api_format.py -v
"""

import asyncio
import hashlib
import json
import os
import sqlite3
import tempfile
import uuid
from pathlib import Path
from typing import ClassVar

import pytest
from pydantic import ValidationError
from sqlalchemy import select

# ── Test environment（须先于 import app 模块设置） ──────────────────────────
_tmp_db = tempfile.NamedTemporaryFile(suffix="_test_apifmt.db", delete=False)  # noqa: SIM115
_tmp_db.close()
_tmp_data_root = tempfile.mkdtemp(prefix="test_apifmt_")

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp_db.name}"
os.environ["DATA_ROOT"] = _tmp_data_root

# Now import the application
import ai_client as ai_client_module
from ai_client import AIClient, get_ai_client_for_user
from api_configs import connection as conn_mod
from api_configs.connection import _build_probe
from api_configs.connection import test_connection as do_test_connection
from api_configs.crypto import encrypt_api_key
from api_configs.schemas import CreateApiConfigBody
from api_configs.service import create_api_config, update_api_config
from backup.export import build_config_package_bytes
from backup.importer import _restore_config
from db import Base, async_session, engine
from models.api_config import ApiConfig
from models.user import User


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture(scope="module", autouse=True)
def _tables():
    _run_async(_create_tables())
    yield


async def _create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _create_user(user_id: str) -> User:
    async with async_session() as session:
        user = User(
            id=user_id,
            email=f"{user_id}@test.com",
            password_hash=hashlib.pbkdf2_hmac(
                "sha256", b"pw", b"ai-novel-salt", 600000
            ).hex(),
            display_name=user_id,
        )
        session.add(user)
        await session.commit()
        return user


async def _create_config(user_id: str, name: str, **kw) -> ApiConfig:
    async with async_session() as session:
        cfg = ApiConfig(
            user_id=user_id,
            name=name,
            vendor=kw.get("vendor", "glm"),
            api_format=kw.get("api_format", "openai"),
            api_key=encrypt_api_key(kw.get("api_key", "sk-test")),
            base_url=kw.get("base_url", "https://open.bigmodel.cn/api/paas/v4"),
            models=kw.get("models"),
            last_test_status=kw.get("last_test_status"),
        )
        session.add(cfg)
        await session.commit()
        await session.refresh(cfg)
        return cfg


# ═════════════════ 1. 存量迁移：等价回填 + 幂等 ═════════════════


class TestMigration:
    """main.py lifespan 里两条 SQL 的语义测试（语句与 main.py 保持镜像）。

    回填条件与旧版运行时嗅探严格等价：URL 含 anthropic 或 vendor=anthropic
    → anthropic，其余 openai。
    """

    MIGRATION_ADD = (
        "ALTER TABLE api_configs ADD COLUMN api_format "
        "VARCHAR(20) NOT NULL DEFAULT 'openai'"
    )
    MIGRATION_BACKFILL = (
        "UPDATE api_configs SET api_format='anthropic' "
        "WHERE (base_url LIKE '%anthropic%' OR vendor='anthropic') "
        "AND api_format <> 'anthropic'"
    )

    def _seed_old_db(self, path: Path) -> sqlite3.Connection:
        conn = sqlite3.connect(path)
        # 旧库：无 api_format 列
        conn.execute(
            "CREATE TABLE api_configs (id TEXT PRIMARY KEY, vendor TEXT, base_url TEXT)"
        )
        rows = [
            ("1", "glm", "https://open.bigmodel.cn/api/anthropic"),  # 嗅探→anthropic
            ("2", "glm", "https://open.bigmodel.cn/api/paas/v4"),  # openai
            ("3", "anthropic", "https://relay.example.com"),  # vendor→anthropic
            ("4", "openai", "https://api.openai.com"),  # openai
            ("5", "kimi", "https://api.moonshot.cn/anthropic"),  # 嗅探→anthropic
        ]
        conn.executemany("INSERT INTO api_configs VALUES (?,?,?)", rows)
        conn.commit()
        return conn

    def _run_migration(self, conn: sqlite3.Connection) -> None:
        try:
            conn.execute(self.MIGRATION_ADD)
            conn.commit()
        except sqlite3.OperationalError:
            pass  # 列已存在（与 main.py try/except 幂等一致）
        conn.execute(self.MIGRATION_BACKFILL)
        conn.commit()

    def test_backfill_equivalent_to_old_sniffing(self, tmp_path):
        conn = self._seed_old_db(tmp_path / "old.db")
        self._run_migration(conn)
        got = dict(conn.execute("SELECT id, api_format FROM api_configs"))
        assert got == {
            "1": "anthropic",
            "2": "openai",
            "3": "anthropic",
            "4": "openai",
            "5": "anthropic",
        }

    def test_rerun_is_noop(self, tmp_path):
        conn = self._seed_old_db(tmp_path / "old.db")
        self._run_migration(conn)
        before = dict(conn.execute("SELECT id, api_format FROM api_configs"))
        self._run_migration(conn)  # 二次启动：ALTER 报错被吞、UPDATE 无匹配行
        after = dict(conn.execute("SELECT id, api_format FROM api_configs"))
        assert before == after


# ═════════════════ 2. AIClient：显式协议优先，嗅探仅兜底 ═════════════════


class _SentinelAnthropic:
    def __init__(self, *args, **kwargs):
        pass


class _SentinelOpenAI:
    def __init__(self, *args, **kwargs):
        pass


@pytest.fixture
def sentinel_clients(monkeypatch):
    monkeypatch.setattr(ai_client_module, "AsyncAnthropic", _SentinelAnthropic)
    monkeypatch.setattr(ai_client_module, "AsyncOpenAI", _SentinelOpenAI)


def _make_client(**kw) -> AIClient:
    return AIClient(api_key="sk-test", base_url=kw.pop("base_url", ""), **kw)


class TestAIClientFormat:
    def test_explicit_anthropic_beats_url(self, sentinel_clients):
        # 显式 anthropic + 不含关键字的 URL → Anthropic（旧嗅探会判错的方向）
        c = _make_client(base_url="https://relay.example.com/v1", api_format="anthropic")
        assert isinstance(c._client, _SentinelAnthropic)

    def test_explicit_openai_beats_url(self, sentinel_clients):
        # 显式 openai + 含 anthropic 的 URL → OpenAI（显式压过嗅探）
        c = _make_client(
            base_url="https://open.bigmodel.cn/api/anthropic", api_format="openai"
        )
        assert isinstance(c._client, _SentinelOpenAI)

    def test_none_falls_back_to_url_sniffing(self, sentinel_clients):
        c = _make_client(
            base_url="https://open.bigmodel.cn/api/anthropic", api_format=None
        )
        assert isinstance(c._client, _SentinelAnthropic)  # legacy 兜底行为不变

    def test_default_is_openai(self, sentinel_clients):
        c = _make_client(base_url="https://api.example.com")
        assert isinstance(c._client, _SentinelOpenAI)


class TestGetAiClientForUser:
    def test_passes_config_api_format(self, sentinel_clients):
        user_id = f"u-{uuid.uuid4().hex[:8]}"
        _run_async(_create_user(user_id))
        _run_async(
            _create_config(
                user_id,
                "中转 anthropic",
                api_format="anthropic",
                base_url="https://relay.example.com/v1",
            )
        )
        client = _run_async(get_ai_client_for_user(user_id))
        assert client._provider == "anthropic"

    def test_openai_format_stays_openai(self, sentinel_clients):
        user_id = f"u-{uuid.uuid4().hex[:8]}"
        _run_async(_create_user(user_id))
        _run_async(
            _create_config(
                user_id,
                "含 anthropic 字样的 openai",
                api_format="openai",
                base_url="https://relay.anthropic-style.example.com",
            )
        )
        client = _run_async(get_ai_client_for_user(user_id))
        assert client._provider == "openai"


# ═════════════════ 3. 连接测试：按协议构造探测 + 404 降级 ═════════════════


class TestBuildProbe:
    def test_anthropic_format_targets_user_base(self):
        url, headers, _extract, fallback = _build_probe(
            "anthropic", "glm", "sk", "https://open.bigmodel.cn/api/anthropic"
        )
        assert url == "https://open.bigmodel.cn/api/anthropic/v1/models"
        assert headers["x-api-key"] == "sk"
        assert headers["anthropic-version"] == "2023-06-01"
        assert fallback is not None
        f_url, _f_headers, f_payload = fallback
        assert f_url == "https://open.bigmodel.cn/api/anthropic/v1/messages"
        assert f_payload["max_tokens"] == 1

    def test_anthropic_strips_trailing_v1(self):
        url, _, _, fallback = _build_probe(
            "anthropic", "glm", "sk", "https://x.example.com/api/anthropic/v1"
        )
        assert url == "https://x.example.com/api/anthropic/v1/models"
        assert fallback[0] == "https://x.example.com/api/anthropic/v1/messages"

    @pytest.mark.parametrize(
        "base,expected",
        [
            ("https://api.openai.com", "https://api.openai.com/v1/models"),
            ("https://api.deepseek.com", "https://api.deepseek.com/v1/models"),
            ("https://api.deepseek.com/v1", "https://api.deepseek.com/v1/models"),
            (
                "https://open.bigmodel.cn/api/paas/v4",
                "https://open.bigmodel.cn/api/paas/v4/models",
            ),
            (
                "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
            ),
        ],
    )
    def test_openai_format_urls(self, base, expected):
        url, headers, _, fallback = _build_probe("openai", "openai", "sk", base)
        assert url == expected
        assert headers == {"Authorization": "Bearer sk"}
        assert fallback is None

    def test_ollama_special_case(self):
        url, headers, _, fallback = _build_probe(
            "openai", "ollama", "", "http://localhost:11434"
        )
        assert url == "http://localhost:11434/api/tags"
        assert headers == {}
        assert fallback is None


class _FakeResp:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {"data": []}

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """替换 httpx.AsyncClient：记录请求并按脚本回放状态码。"""

    script: ClassVar[list] = []  # 每次调用依次弹出：(method, status_code)
    calls: ClassVar[list] = []

    def __init__(self, **kw):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, headers=None):
        type(self).calls.append(("GET", url, headers))
        method, status = type(self).script.pop(0)
        assert method == "GET"
        return _FakeResp(status)

    async def post(self, url, headers=None, json=None):
        type(self).calls.append(("POST", url, headers, json))
        method, status = type(self).script.pop(0)
        assert method == "POST"
        return _FakeResp(status)


@pytest.fixture
def fake_http(monkeypatch):
    _FakeAsyncClient.script = []
    _FakeAsyncClient.calls = []
    monkeypatch.setattr(
        conn_mod.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(**kw)
    )
    return _FakeAsyncClient


class TestConnectionFlow:
    def test_models_200_no_fallback(self, fake_http):
        fake_http.script = [("GET", 200)]
        out = _run_async(
            do_test_connection(
                "glm", "sk", "https://open.bigmodel.cn/api/anthropic", "anthropic"
            )
        )
        assert out["ok"] is True and out["models"] == []
        assert [c[0] for c in fake_http.calls] == ["GET"]

    def test_models_404_falls_back_to_messages(self, fake_http):
        fake_http.script = [("GET", 404), ("POST", 200)]
        out = _run_async(
            do_test_connection(
                "glm", "sk", "https://open.bigmodel.cn/api/anthropic", "anthropic"
            )
        )
        assert out["ok"] is True and out["models"] == []
        kinds = [c[0] for c in fake_http.calls]
        assert kinds == ["GET", "POST"]
        assert fake_http.calls[1][1].endswith("/v1/messages")

    def test_fallback_auth_failure(self, fake_http):
        fake_http.script = [("GET", 404), ("POST", 401)]
        out = _run_async(
            do_test_connection(
                "glm", "sk", "https://open.bigmodel.cn/api/anthropic", "anthropic"
            )
        )
        assert out["ok"] is False and out["status"] == "auth_error"

    def test_openai_format_no_fallback_on_404(self, fake_http):
        fake_http.script = [("GET", 404)]
        out = _run_async(
            do_test_connection("openai", "sk", "https://api.openai.com", "openai")
        )
        # openai 格式 404 = 端点问题，原样走异常响应分支，不降级
        assert out["ok"] is False
        assert [c[0] for c in fake_http.calls] == ["GET"]

    def test_openai_format_uses_user_base_not_official(self, fake_http):
        fake_http.script = [("GET", 200)]
        _run_async(
            do_test_connection("openai", "sk", "https://my-relay.example.com", "openai")
        )
        assert fake_http.calls[0][1] == "https://my-relay.example.com/v1/models"

    def test_empty_key_rejected(self, fake_http):
        out = _run_async(do_test_connection("glm", "  ", "https://x.example.com", "openai"))
        assert out["ok"] is False and out["status"] == "auth_error"
        assert fake_http.calls == []


# ═════════════════ 4. 契约：create/update 语义 ═════════════════


class TestContract:
    def test_create_without_format_derives_like_old_runtime(self):
        user_id = f"u-{uuid.uuid4().hex[:8]}"
        _run_async(_create_user(user_id))

        async def _go():
            async with async_session() as db:
                a = await create_api_config(
                    db, user_id, "官方", "anthropic", "https://api.anthropic.com"
                )
                b = await create_api_config(
                    db,
                    user_id,
                    "GLM anthropic",
                    "glm",
                    "https://open.bigmodel.cn/api/anthropic",
                )
                c = await create_api_config(
                    db, user_id, "GLM openai", "glm", "https://open.bigmodel.cn/api/paas/v4"
                )
            return a, b, c

        a, b, c = _run_async(_go())
        assert a["api_format"] == "anthropic"  # vendor=anthropic → anthropic
        assert b["api_format"] == "anthropic"  # URL 嗅探兜底（旧前端等价）
        assert c["api_format"] == "openai"

    def test_create_explicit_format_wins(self):
        user_id = f"u-{uuid.uuid4().hex[:8]}"
        _run_async(_create_user(user_id))

        async def _go():
            async with async_session() as db:
                return await create_api_config(
                    db,
                    user_id,
                    "中转",
                    "openai-compat",
                    "https://relay.example.com/v1",
                    api_format="anthropic",
                )

        assert _run_async(_go())["api_format"] == "anthropic"

    def test_body_rejects_unknown_format(self):
        with pytest.raises(ValidationError):
            CreateApiConfigBody(
                name="x", vendor_id="glm", base_url="https://x", api_format="graphql"
            )

    async def _seed_and_update(self, updates: dict):
        user_id = f"u-{uuid.uuid4().hex[:8]}"
        await _create_user(user_id)
        async with async_session() as session:
            cfg = ApiConfig(
                user_id=user_id,
                name="配置",
                vendor="glm",
                api_format="anthropic",
                api_key=encrypt_api_key("sk"),
                base_url="https://open.bigmodel.cn/api/anthropic",
                models=json.dumps(["glm-4.7"]),
                last_test_status="ok",
            )
            session.add(cfg)
            await session.commit()
            cid = cfg.id
        async with async_session() as db:
            out = await update_api_config(db, user_id, cid, updates)
        return out

    def test_update_format_clears_models_and_test_state(self):
        out = _run_async(self._seed_and_update({"api_format": "openai"}))
        assert out["api_format"] == "openai"
        assert out["models"] == []
        assert out["last_test_status"] is None

    def test_update_without_format_touches_nothing(self):
        out = _run_async(self._seed_and_update({"name": "改名"}))
        assert out["api_format"] == "anthropic"
        assert out["models"] == ["glm-4.7"]
        assert out["last_test_status"] == "ok"

    def test_update_base_url_keeps_format(self):
        out = _run_async(
            self._seed_and_update({"base_url": "https://open.bigmodel.cn/api/paas/v4"})
        )
        # vendor 被重识别也仍是 glm，且协议不被回写
        assert out["vendor"] == "glm"
        assert out["api_format"] == "anthropic"


# ═════════════════ 5. 备份 roundtrip：加键 + 旧包默认 ═════════════════


class TestBackupRoundtrip:
    def test_export_includes_api_format(self):
        import io
        import zipfile

        import yaml

        user_id = f"u-{uuid.uuid4().hex[:8]}"
        _run_async(_create_user(user_id))
        _run_async(
            _create_config(
                user_id,
                "anthropic 行",
                api_format="anthropic",
                base_url="https://open.bigmodel.cn/api/anthropic",
            )
        )

        async def _go():
            async with async_session() as db:
                return await build_config_package_bytes(db, user_id)

        payload_bytes, _name = _run_async(_go())
        with zipfile.ZipFile(io.BytesIO(payload_bytes)) as zf:
            data = yaml.safe_load(zf.read("config.yaml"))
        entries = data["api_configs"]
        assert entries[0]["api_format"] == "anthropic"

    def test_import_old_package_without_key_defaults_openai(self):
        user_id = f"u-{uuid.uuid4().hex[:8]}"
        _run_async(_create_user(user_id))
        old_entry = {
            "name": "旧包配置",
            "vendor": "glm",
            "vendor_display_name": "GLM",
            "api_key": "sk-old",
            "base_url": "https://open.bigmodel.cn/api/paas/v4",
        }

        async def _go():
            async with async_session() as db:
                out = await _restore_config(db, user_id, {"api_configs": [old_entry]})
                await db.commit()  # _restore_config 只 flush 不 commit（router 侧收口）
                return out

        out = _run_async(_go())
        assert out["created"] == 1

        async def _read():
            async with async_session() as db:
                cfg = (
                    await db.scalars(
                        select(ApiConfig).where(ApiConfig.user_id == user_id)
                    )
                ).first()
                return cfg.api_format

        assert _run_async(_read()) == "openai"

    def test_import_new_package_preserves_anthropic(self):
        user_id = f"u-{uuid.uuid4().hex[:8]}"
        _run_async(_create_user(user_id))
        entry = {
            "name": "新包 anthropic",
            "vendor": "glm",
            "api_key": "sk",
            "base_url": "https://open.bigmodel.cn/api/anthropic",
            "api_format": "anthropic",
        }

        async def _go():
            async with async_session() as db:
                await _restore_config(db, user_id, {"api_configs": [entry]})
                await db.commit()  # _restore_config 只 flush 不 commit
                await db.commit()
                cfg = (
                    await db.scalars(
                        select(ApiConfig).where(ApiConfig.user_id == user_id)
                    )
                ).first()
                return cfg.api_format

        assert _run_async(_go()) == "anthropic"
