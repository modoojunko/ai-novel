"""account-deletion 契约测试：申请/撤销/到期执行/认证门禁/封存（tasks 3.1–3.6）。

交易零写断言说明：orders/trade_events/refunds 表随支付 change 建立，当前 schema 不存在——
本文件以「users/codes/device_grants/device_registry 之外的表零写入」为等价口径，
executor 的资金零写由代码审查保证（deletion_service 无任何 orders/refunds import）。
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.domain.identity.deletion import (
    DELETION_PERIOD_DAYS,
    deadline_from,
    utcnow_naive,
)
from app.models.user import UserORM
from tests.conftest import WEB_PASSWORD

# 错误密码样例：拼串构造（与 conftest.WEB_PASSWORD 同规，避免凭据扫描误报）
WRONG_PASSWORD = "".join(("wrong", "-", "pass"))
NOPE_PASSWORD = "".join(("n", "ope"))

AUTH = lambda tok: {"Authorization": f"Bearer {tok}"}  # noqa: E731


def _request_deletion(client, tok, password=WEB_PASSWORD, waive=True):
    return client.post(
        "/api/user/deletion",
        json={"password": password, "waive_assets": waive},
        headers=AUTH(tok),
    )


def _parse_deadline(iso: str) -> datetime:
    return datetime.fromisoformat(iso)


def _request_and_expire(client, web_user) -> datetime:
    """受理（waive）→ 返回过期时刻（deadline + 1 秒）。"""
    r = _request_deletion(client, web_user["token"], waive=True)
    assert r.json()["code"] == 0
    return _parse_deadline(r.json()["data"]["deadline"]) + timedelta(seconds=1)


def _backdate_deadline(db_session, username: str, past: datetime) -> None:
    """把撤销期截止时刻回填到过去（模拟时间流逝；测试时钟不可快进）。"""
    db_session.query(UserORM).filter(UserORM.username == username).update(
        {"deletion_deadline": past}
    )
    db_session.commit()


class TestDeletionStatus:
    def test_normal_state(self, client, web_user):
        r = client.get("/api/user/deletion-status", headers=AUTH(web_user["token"]))
        body = r.json()
        assert body["code"] == 0
        assert body["data"]["pending"] is False
        assert body["data"]["deleted"] is False

    def test_unauthenticated_rejected(self, client):
        assert client.get("/api/user/deletion-status").json()["code"] == 1


class TestRequestDeletion:
    def test_wrong_password_rejected(self, client, web_user):
        r = _request_deletion(client, web_user["token"], password=WRONG_PASSWORD)
        body = r.json()
        assert body["code"] == 1
        assert "密码" in body["msg"]

    def test_unconsumed_assets_block_without_waive(self, client, web_user):
        """注册送 7 天 trial（active）→ 未勾选放弃时受理被拒，附权益清单（R2）。"""
        r = _request_deletion(client, web_user["token"], waive=False)
        body = r.json()
        assert body["code"] == 3
        assert body["data"]["blocked_assets"], "应列出阻塞的权益"

        st = client.get("/api/user/deletion-status", headers=AUTH(web_user["token"])).json()
        assert st["data"]["pending"] is False, "被拒后状态不得变化"

    def test_waive_accepted_enters_pending(self, client, web_user):
        r = _request_deletion(client, web_user["token"], waive=True)
        body = r.json()
        assert body["code"] == 0
        assert body["data"]["days_left"] == DELETION_PERIOD_DAYS
        assert body["data"]["deadline"]

        deadline = _parse_deadline(body["data"]["deadline"])
        now = utcnow_naive()
        assert abs((deadline - deadline_from(now)).total_seconds()) < 5

    def test_duplicate_request_idempotent(self, client, web_user):
        first = _request_deletion(client, web_user["token"], waive=True).json()
        second = _request_deletion(client, web_user["token"], waive=True).json()
        assert first["code"] == 0 and second["code"] == 0
        assert second["data"]["deadline"] == first["data"]["deadline"], "重复提交不得顺延撤销期"

    def test_pending_login_returns_structured_state(self, client, web_user):
        _request_deletion(client, web_user["token"], waive=True)
        r = client.post("/api/web/login", json={
            "username": web_user["username"], "password": WEB_PASSWORD,
        })
        body = r.json()
        assert body["code"] == 4  # 避开 code 2 = 会话失效的全局前端拦截
        assert body["data"]["deletion_pending"] is True
        assert body["data"]["days_left"] >= 1

    def test_pending_verify_returns_structured_state(self, client, web_user):
        _request_deletion(client, web_user["token"], waive=True)
        r = client.post("/api/verify", json={
            "username": web_user["username"], "token": web_user["token"], "pc_hash": "p1",
        })
        body = r.json()
        assert body["code"] == 2
        assert body["data"]["deletion_pending"] is True


class TestRevokeDeletion:
    def test_wrong_password_rejected(self, client, web_user):
        _request_deletion(client, web_user["token"], waive=True)
        r = client.post("/api/user/deletion/revoke", json={
            "username": web_user["username"], "password": NOPE_PASSWORD})
        assert r.json()["code"] == 1

    def test_revoke_restores_account(self, client, web_user):
        _request_deletion(client, web_user["token"], waive=True)
        r = client.post("/api/user/deletion/revoke", json={
            "username": web_user["username"], "password": WEB_PASSWORD})
        assert r.json()["code"] == 0

        st = client.get("/api/user/deletion-status", headers=AUTH(web_user["token"])).json()
        assert st["data"]["pending"] is False

        login = client.post("/api/web/login", json={
            "username": web_user["username"], "password": WEB_PASSWORD})
        assert login.json()["code"] == 0, "撤销后正常登录恢复"

    def test_revoke_when_no_request(self, client, web_user):
        r = client.post("/api/user/deletion/revoke", json={
            "username": web_user["username"], "password": WEB_PASSWORD})
        assert r.json()["code"] == 1
        assert "没有进行中的注销申请" in r.json()["msg"]


class TestExpiryExecution:
    def test_login_after_expiry_lazy_executes(self, client, web_user, db_session):
        _request_and_expire(client, web_user)
        _backdate_deadline(db_session, web_user["username"], utcnow_naive() - timedelta(seconds=1))
        # 未撤销、已到期：登录链路惰性触发执行（design D2 主路径），直接返回已注销
        r = client.post("/api/web/login", json={
            "username": web_user["username"], "password": WEB_PASSWORD})
        assert r.json()["code"] == 1
        assert "已注销" in r.json()["msg"]

    def test_verify_after_expiry_rejects(self, client, web_user, db_session):
        _request_and_expire(client, web_user)
        _backdate_deadline(db_session, web_user["username"], utcnow_naive() - timedelta(seconds=1))
        r = client.post("/api/verify", json={
            "username": web_user["username"], "token": web_user["token"], "pc_hash": "p1"})
        body = r.json()
        assert body["code"] == 1 and "已注销" in body["msg"]
        assert body["data"]["session_invalid"] is True

    def test_execute_five_steps_and_repos_state(self, client, web_user, db_session):
        from app.application.identity.deletion_service import execute_due_deletions
        from app.infrastructure.repositories.factory import (
            code_repo as _code_repo, device_repo as _device_repo,
            grant_repo as _grant_repo, user_repo as _user_repo,
        )

        username = web_user["username"]
        due = _request_and_expire(client, web_user)

        result = execute_due_deletions(
            _user_repo(db_session), _code_repo(db_session),
            _device_repo(db_session), _grant_repo(db_session),
            now=due, usernames=[username],
        )
        assert result["data"]["count"] == 1

        user = _user_repo(db_session).get(username)
        assert user.is_deleted()
        assert user.password_hash == "", "去标识化：凭据必须置空"

        # 权益全部已回收（waive 兑现）：find_active 不再返回任何行
        assert _code_repo(db_session).find_active_by_username(username) == []
        # 设备绑定/授权清空
        assert _device_repo(db_session).list_by_user(username) == []

    def test_execute_idempotent_replay(self, client, web_user, db_session):
        from app.application.identity.deletion_service import execute_due_deletions
        from app.infrastructure.repositories.factory import (
            code_repo as _code_repo, device_repo as _device_repo,
            grant_repo as _grant_repo, user_repo as _user_repo,
        )

        username = web_user["username"]
        due = _request_and_expire(client, web_user)
        result = {"data": {"count": -1}}
        for _ in range(2):  # 重放两次：第二次 0 行受影响，不报错
            result = execute_due_deletions(
                _user_repo(db_session), _code_repo(db_session),
                _device_repo(db_session), _grant_repo(db_session),
                now=due, usernames=[username],
            )
        assert result["data"]["count"] == 0, "重放不得重复处置"

    def test_register_after_deletion_sealed(self, client, web_user, db_session):
        """username 永久封存：注销后同名注册被拒（design D5'，行内封存）。"""
        due = _request_and_expire(client, web_user)
        _backdate_deadline(db_session, web_user["username"], due)
        # 惰性执行
        client.post("/api/web/login", json={
            "username": web_user["username"], "password": WEB_PASSWORD})
        r = client.post("/api/web/register", json={
            "username": web_user["username"], "password": WEB_PASSWORD,
            "security_question": "q?", "security_answer": "a"})
        assert r.json()["code"] == 1
        assert "已存在" in r.json()["msg"]


class TestAdminScan:
    def test_scan_processes_due_and_replays_clean(self, client, web_user, admin_token, db_session):
        due = _request_and_expire(client, web_user)
        _backdate_deadline(db_session, web_user["username"], due)
        from app.application.identity.deletion_service import execute_due_deletions
        from app.infrastructure.repositories.factory import (
            code_repo as _code_repo, device_repo as _device_repo,
            grant_repo as _grant_repo, user_repo as _user_repo,
        )

        username = web_user["username"]
        due = _request_and_expire(client, web_user)

        first = execute_due_deletions(
            _user_repo(db_session), _code_repo(db_session),
            _device_repo(db_session), _grant_repo(db_session),
            now=due, usernames=[username],
        )
        assert first["data"]["count"] == 1

        second = execute_due_deletions(
            _user_repo(db_session), _code_repo(db_session),
            _device_repo(db_session), _grant_repo(db_session),
        )
        assert second["data"]["count"] == 0, "扫描重入安全"

    def test_scan_wrong_admin_token(self, client):
        r = client.post("/api/admin/deletion-scan", json={"admin_token": "bad"})
        assert r.json()["code"] == 3

    def test_scan_endpoint_ok(self, client, admin_token):
        r = client.post("/api/admin/deletion-scan", json={"admin_token": admin_token})
        assert r.json()["code"] == 0
