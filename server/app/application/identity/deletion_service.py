"""账号自助注销用例（account-deletion，design D1–D4）。

全部资金无关：权益处置的退款走既有订单退款链路（向导引导），本模块只做
「放弃权益」的执行（codes 置 revoked），不产生任何退款写操作。
"""
from __future__ import annotations

import logging

from app.domain.identity import User
from app.domain.identity.deletion import (
    DELETION_PERIOD_DAYS,
    deadline_from,
    is_due,
    remaining_days,
    utcnow_naive,
)
from app.infrastructure.repositories.base import (
    CodeRepo,
    DeviceRepo,
    GrantRepo,
    UserRepo,
)
from app.infrastructure.security.password import verify_password

logger = logging.getLogger("app.identity.deletion")


def deletion_payload(user: User, now=None) -> dict:
    """结构化注销状态（R7：S 端撤销页与 C 端登录失效处理共用）。"""
    deadline = user.deletion_deadline
    return {
        "deletion_pending": True,
        "status": user.effective_deletion_status,
        "days_left": remaining_days(deadline, now) if deadline else 0,
        "deadline": deadline.isoformat() if deadline else "",
        "requested_at": user.deletion_requested_at.isoformat() if user.deletion_requested_at else "",
    }


def blocked_assets(code_repo: CodeRepo, username: str) -> list[dict]:
    """未消耗权益清单：unused（待激活）+ active（排队中/消耗中）都阻塞注销并向导展示（R2）。"""
    return [
        {"code_id": c.code_id, "tier": c.tier, "status": c.status,
         "duration_days": c.duration_days,
         "expires_at": c.expires_at.isoformat() if c.expires_at else ""}
        for c in code_repo.find_unconsumed_by_username(username)
    ]


def deletion_status(user: User, now=None) -> dict:
    """查询注销状态（R7）。user 为已取出的 User 实体。"""
    now = now or utcnow_naive()
    if user.is_deletion_pending():
        return {"code": 0, "data": {"pending": True, **deletion_payload(user, now)}}
    if user.is_deleted():
        return {"code": 0, "data": {"pending": False, "deleted": True}}
    return {"code": 0, "data": {"pending": False, "deleted": False}}


def request_deletion(
    user_repo: UserRepo,
    code_repo: CodeRepo,
    username: str,
    password: str,
    waive_assets: bool,
    now=None,
) -> dict:
    """受理注销申请（R2/R3/R4）。

    - 密码二次确认（是本人）；
    - 未消耗权益未处置 → 拒绝受理（code=3，附权益清单，向导引导去退款或勾选放弃）；
    - 单语句 CAS 受理（重复提交幂等：0 行受影响时返回当前撤销期状态而非报错）。
    """
    now = now or utcnow_naive()
    user = user_repo.get(username)
    if not user or not verify_password(password, user.password_hash):
        return {"code": 1, "msg": "用户名或密码错误"}
    if user.is_deleted():
        return {"code": 1, "msg": "该账号已注销"}

    assets = blocked_assets(code_repo, username)
    if assets and not waive_assets:
        return {"code": 3, "msg": "存在未消耗的套餐权益，请先退款或确认放弃",
                "data": {"blocked_assets": assets}}

    deadline = deadline_from(now)
    rows = user_repo.request_deletion(username, now, deadline, waive_assets)
    if rows == 0:
        # 并发/重复提交：已在撤销期 → 幂等返回当前状态
        fresh = user_repo.get(username)
        return {"code": 0, "msg": "注销申请已在处理中",
                "data": {"pending": True, **deletion_payload(fresh, now)}}
    logger.info("event=deletion.requested user=%s deadline=%s waive=%s assets=%d",
                username, deadline.isoformat(), waive_assets, len(assets))
    return {"code": 0, "msg": "注销申请已提交", "data": {"pending": True, "days_left": DELETION_PERIOD_DAYS,
                                                          "deadline": deadline.isoformat()}}


def revoke_deletion(user_repo: UserRepo, username: str, password: str, now=None) -> dict:
    """撤销注销（R4）：密码同强度验证 + CAS；与到期执行竞态时必有一方失败。"""
    now = now or utcnow_naive()
    user = user_repo.get(username)
    if not user or not verify_password(password, user.password_hash):
        return {"code": 1, "msg": "用户名或密码错误"}
    if user.is_deleted():
        return {"code": 1, "msg": "账号已注销，无法撤销"}
    if not user.is_deletion_pending():
        return {"code": 1, "msg": "当前没有进行中的注销申请"}

    rows = user_repo.revoke_deletion(username, now)
    if rows == 0:
        # CAS 落败：到期执行已抢先完成（或恰好越线）
        return {"code": 1, "msg": "撤销期已结束，账号已完成注销"}
    logger.info("event=deletion.revoked user=%s", username)
    return {"code": 0, "msg": "已撤销注销，账号恢复正常"}


def execute_due_deletions(
    user_repo: UserRepo,
    code_repo: CodeRepo,
    device_repo: DeviceRepo,
    grant_repo: GrantRepo,
    now=None,
    usernames: list[str] | None = None,
) -> dict:
    """到期执行器（R5，design D2）：惰性触发与定时扫描共用，逐账号五步幂等序列。

    1. CAS 标记 已注销 + password_hash 置空（唯一一次状态跃迁，先行——半处置状态
       不会对外表现为"还活着"）；
    2. device_registry 清空；3. device_grants 清空；
    4. 未消耗权益置 revoked（waive 兑现；退款路径的用户此时权益已 revoked，幂等 0 行）；
    5. 结构化审计日志（trade_events 审计表随支付 change 建立后可双写，见 design 补注）。

    交易数据（orders/trade_events/refunds）零写操作——P2 决策：依法留存、去关联在展示层。
    """
    now = now or utcnow_naive()
    due = usernames if usernames is not None else user_repo.find_due_deletion_usernames(now)
    processed: list[str] = []
    for username in due:
        marked = user_repo.mark_deleted(username, now)
        if not marked:
            continue  # CAS 落败：已被并发方执行或用户刚撤销——重入安全
        devices = device_repo.delete_all_for_user(username)
        grants = grant_repo.delete_all_for_user(username)
        recycled = code_repo.revoke_unconsumed_for_user(username)
        processed.append(username)
        logger.info(
            "event=deletion.executed user=%s devices=%d grants=%d codes_revoked=%d",
            username, devices, grants, recycled,
        )
    return {"code": 0, "data": {"processed": processed, "count": len(processed)}}


def lazy_execute_if_due(
    user_repo: UserRepo,
    code_repo: CodeRepo,
    device_repo: DeviceRepo,
    grant_repo: GrantRepo,
    username: str,
    now=None,
) -> None:
    """惰性触发（design D2 主路径）：认证/check-auth 读取用户状态时顺带执行到期注销。

    任何调用点都无需关心是否到期——未到期或不在流程中时本函数是 no-op。
    """
    user = user_repo.get(username)
    if not user or not user.is_deletion_pending():
        return
    deadline = user.deletion_deadline
    if deadline and is_due(deadline, now):
        execute_due_deletions(user_repo, code_repo, device_repo, grant_repo,
                              now=now, usernames=[username])
