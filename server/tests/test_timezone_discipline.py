"""TZ 口径抗性：存储/计算永远 naive UTC，不随部署环境 TZ 偏移。

拍板背景（2026-09-01）：面向用户的展示走前端 fmtBj 转 Asia/Shanghai；
后端存储与计算锁 naive UTC，容器/DB 时区不作口径依据。本文件模拟
「有人把部署时区改成上海」的最坏情况，断言关键链路不偏移
（判别力：混入本地 now 会偏 28800s=8h，断言容差 5s/120s 远小于偏移量）。
"""
from __future__ import annotations

import os
import time

import pytest

pytestmark = pytest.mark.skipif(os.name == "nt", reason="time.tzset 仅 Unix 可用")


@pytest.fixture
def tz_shanghai():
    """进程时区切到 Asia/Shanghai（展示时区当部署时区用的最坏情况）。"""
    old = os.environ.get("TZ")
    os.environ["TZ"] = "Asia/Shanghai"
    time.tzset()
    try:
        yield
    finally:
        if old is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = old
        time.tzset()


def _utc_now_naive():
    from datetime import UTC, datetime

    return datetime.now(UTC).replace(tzinfo=None)


def _register(client, uid) -> dict:
    username = f"tzd_{uid}"
    password = "".join(("Tz", "-Discipline-", "42"))
    r = client.post("/api/web/register", json={
        "username": username,
        "password": password,
        "security_question": "q?",
        "security_answer": "a",
    })
    assert r.json()["code"] == 0, r.text
    return {"username": username, "token": r.json()["data"]["token"]}


class TestNaiveUtcDiscipline:
    def test_license_remaining(self, client, web_user, tz_shanghai):
        """总览剩余秒数 = max_expires_at − UTC now（TZ=上海下不偏 8 小时）。"""
        r = client.get("/api/pay/license", headers={
            "Authorization": f"Bearer {web_user['token']}"})
        body = r.json()
        assert body["code"] == 0, body

        from datetime import datetime
        max_exp = datetime.fromisoformat(body["data"]["max_expires_at"])
        expected = int(max(0, (max_exp - _utc_now_naive()).total_seconds()))
        assert abs(body["data"]["remaining_sec"] - expected) < 5

    def test_register_writes_utc(self, client, uid, db_session, tz_shanghai):
        """TZ=上海下注册：trial 码 created_at 仍是 UTC 墙上时间。"""
        from app.infrastructure.repositories.factory import user_repo
        from app.models.code import ActivationCodeORM

        user = _register(client, uid)
        uid_int = user_repo(db_session).get_id(user["username"])
        row = (
            db_session.query(ActivationCodeORM)
            .filter(ActivationCodeORM.user_id == uid_int)
            .first()
        )
        assert row is not None and row.created_at is not None
        assert abs((row.created_at - _utc_now_naive()).total_seconds()) < 120
