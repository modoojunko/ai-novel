"""CloudBase PG HTTP API 用户仓储。"""
from __future__ import annotations

import time

from app.domain.identity import User
from app.domain.identity.deletion import (
    DELETION_STATUS_DELETED,
    DELETION_STATUS_NORMAL,
    DELETION_STATUS_PENDING,
)
from app.infrastructure.repositories.pg_http.client import PgRestClient, parse_dt

_TABLE = "users"

# get_id 进程内 TTL 缓存（orders-page-latency）：username→user_id 每请求都要解析，
# pg_http 每解析一趟 HTTPS 往返。只缓存命中（None 不缓存，"用户不存在"即时可见）；
# 软标记删号不物理删行，缓存不改变 get_id 语义；账号生命周期事件（注销/改名）走
# invalidate_id 主动失效，最坏 TTL 窗口内自愈。容量超限整体清空（个人站点量级）。
_ID_CACHE_TTL_SECONDS = 300.0
_ID_CACHE_MAX_ENTRIES = 512
_id_cache: dict[str, tuple[int, float]] = {}


def invalidate_id(username: str) -> None:
    """按用户名主动丢弃 user_id 解析缓存（账号注销/改名等生命周期事件接线用）。"""
    _id_cache.pop(username, None)


class PgHttpUserRepo:
    def __init__(self, client: PgRestClient):
        self.client = client

    @staticmethod
    def _to_domain(doc: dict) -> User:
        return User(
            username=doc["username"],
            password_hash=doc["password_hash"],
            status=doc.get("status", "active"),
            security_question=doc.get("security_question", "") or "",
            security_answer_hash=doc.get("security_answer_hash", "") or "",
            created_at=parse_dt(doc.get("created_at")),
            theme=doc.get("theme", "") or "",
            deletion_status=doc.get("deletion_status", "") or "正常",
            deletion_requested_at=parse_dt(doc.get("deletion_requested_at")),
            deletion_deadline=parse_dt(doc.get("deletion_deadline")),
            deletion_waive_assets=bool(doc.get("deletion_waive_assets", False)),
        )

    def get(self, username: str) -> User | None:
        doc = self.client.find_one(_TABLE, {"username": username})
        return self._to_domain(doc) if doc else None

    def get_id(self, username: str) -> int | None:
        """username → user_id（代理键解析，与 SqlUserRepo.get_id 对齐）。

        命中进程内 TTL 缓存时免 DB 往返；缓存对调用方透明（命中/回源结果一致）。
        """
        now = time.monotonic()
        hit = _id_cache.get(username)
        if hit is not None and now - hit[1] < _ID_CACHE_TTL_SECONDS:
            return hit[0]
        if hit is not None:
            _id_cache.pop(username, None)
        doc = self.client.find_one(_TABLE, {"username": username})
        if doc is None or doc.get("id") is None:
            return None
        uid = int(doc["id"])
        if len(_id_cache) >= _ID_CACHE_MAX_ENTRIES:
            _id_cache.clear()
        _id_cache[username] = (uid, now)
        return uid

    def exists(self, username: str) -> bool:
        return self.client.find_one(_TABLE, {"username": username}) is not None

    def create(self, user: User) -> User:
        # 省略 created_at：数据库 DEFAULT now()
        self.client.insert(_TABLE, {
            "username": user.username,
            "password_hash": user.password_hash,
            "security_question": user.security_question,
            "security_answer_hash": user.security_answer_hash,
            "status": user.status,
        })
        invalidate_id(user.username)  # 同名注销后重注册：旧 id 缓存条目作废
        return user

    def update_password(self, username: str, new_password_hash: str) -> None:
        self.client.update(_TABLE, {"username": username}, {"password_hash": new_password_hash})

    def update_security(self, username: str, question: str, answer_hash: str) -> None:
        self.client.update(
            _TABLE,
            {"username": username},
            {"security_question": question, "security_answer_hash": answer_hash},
        )

    def update_theme(self, username: str, theme: str) -> None:
        self.client.update(_TABLE, {"username": username}, {"theme": theme})

    def flush(self) -> None:
        """无 FK 顺序问题，no-op。"""
        return

    # ── 账号自助注销（account-deletion）：单语句 CAS，受影响行数即语义 ──
    def request_deletion(self, username: str, requested_at, deadline, waive: bool) -> int:
        """WHERE deletion_status='正常'（迁移已给存量行回填默认值，无 NULL）；0 行=已在流程中。"""
        return self.client.update_cas(
            _TABLE,
            {"username": f"eq.{username}", "deletion_status": f"eq.{DELETION_STATUS_NORMAL}"},
            {
                "deletion_status": DELETION_STATUS_PENDING,
                "deletion_requested_at": requested_at.isoformat(),
                "deletion_deadline": deadline.isoformat(),
                "deletion_waive_assets": bool(waive),
            },
        )

    def revoke_deletion(self, username: str, now) -> int:
        """WHERE status='注销撤销期' AND deadline>now（gt.{iso}）；0 行=已到期或无申请。"""
        return self.client.update_cas(
            _TABLE,
            {
                "username": f"eq.{username}",
                "deletion_status": f"eq.{DELETION_STATUS_PENDING}",
                "deletion_deadline": f"gt.{now.isoformat()}",
            },
            {"deletion_status": DELETION_STATUS_NORMAL,
             "deletion_requested_at": None, "deletion_deadline": None,
             "deletion_waive_assets": False},
        )

    def mark_deleted(self, username: str, now) -> int:
        """到期执行标记：CAS 到位即置空凭据（去标识化第一步）。"""
        return self.client.update_cas(
            _TABLE,
            {
                "username": f"eq.{username}",
                "deletion_status": f"eq.{DELETION_STATUS_PENDING}",
                "deletion_deadline": f"lte.{now.isoformat()}",
            },
            {"deletion_status": DELETION_STATUS_DELETED, "password_hash": ""},
        )

    def find_due_deletion_usernames(self, now) -> list[str]:
        rows = self.client.find(
            _TABLE,
            {"deletion_status": f"eq.{DELETION_STATUS_PENDING}", "deletion_deadline": f"lte.{now.isoformat()}"},
            select="username",
        )
        return [r["username"] for r in rows]
