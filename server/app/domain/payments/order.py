"""订单状态机：转移表 + CAS 条件 + 领域校验。

设计依据：backend-detail-design.md §3.1。
表即状态机——应用层零内存状态，每次转移 = 一次 compare_and_update。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


class InvalidTransition(Exception):
    """非法状态转移（防御性；正常路径由 CAS 兜住并发）。"""

    def __init__(self, from_status: str, trigger: str):
        self.from_status = from_status
        self.trigger = trigger
        super().__init__(f"Invalid transition: {from_status} --{trigger}-->")


@dataclass(frozen=True)
class Transition:
    """一条状态转移：trigger 唯一标识触发原因。"""
    from_status: str
    trigger: str
    to_status: str
    cas_where: str  # SQL WHERE 片段（除 PK 外的 CAS 条件）
    description: str = ""


# ── 状态常量 ──
PENDING = "pending"
PAID = "paid"
FULFILLED = "fulfilled"
REFUND_PENDING = "refund_pending"       # 冷静期
REFUND_PROCESSING = "refund_processing"  # 已提交微信
REFUNDED = "refunded"
CLOSED = "closed"
EXCEPTION = "exception"

ALL_STATUSES = [PENDING, PAID, FULFILLED, REFUND_PENDING, REFUND_PROCESSING,
                REFUNDED, CLOSED, EXCEPTION]

# ── 转移表（§3.1 定稿 11 条）──
TRANSITIONS: list[Transition] = [
    Transition(PENDING, "payment_confirmed", PAID,
               "status IN ('pending','closed')",
               "支付确认（含 closed→paid 复活）"),
    Transition(PAID, "delivery_complete", FULFILLED,
               "status = 'paid'",
               "codes 行已插入"),
    Transition(PENDING, "timeout_close", CLOSED,
               "status = 'pending'",
               "关单铁律：微信关单成功后"),
    Transition(PENDING, "amount_mismatch", EXCEPTION,
               "status = 'pending'",
               "回调金额 ≠ 订单金额"),
    Transition(FULFILLED, "refund_requested", REFUND_PENDING,
               "status = 'fulfilled'",
               "进入冷静期：冻结 codes + 锁定金额"),
    Transition(REFUND_PENDING, "refund_canceled", FULFILLED,
               "status = 'refund_pending' AND cooldown_ends_at > now()",
               "冷静期用户取消：解冻恢复"),
    Transition(REFUND_PENDING, "cooldown_expired", REFUND_PROCESSING,
               "status = 'refund_pending' AND cooldown_ends_at <= now()",
               "冷静期到点自动提交微信"),
    Transition(REFUND_PENDING, "refund_succeeded", REFUNDED,
               "status = 'refund_pending'",
               "退款成功（回调/查单）"),
    Transition(REFUND_PROCESSING, "refund_succeeded", REFUNDED,
               "status = 'refund_processing'",
               "退款成功（回调/查单）"),
    Transition(REFUND_PROCESSING, "admin_offline_settled", REFUNDED,
               "status = 'refund_processing'",
               "ADMIN：线下退款完成登记"),
    Transition(REFUND_PROCESSING, "admin_abandon_unfreeze", FULFILLED,
               "status = 'refund_processing'",
               "ADMIN：协商放弃退款、恢复套餐"),
    Transition(EXCEPTION, "admin_full_refund", REFUNDED,
               "status = 'exception'",
               "ADMIN：exception 单全额退款"),
]

# 索引：(from_status, trigger) → Transition
_TRANSITION_MAP: dict[tuple[str, str], Transition] = {
    (t.from_status, t.trigger): t for t in TRANSITIONS
}


def get_transition(from_status: str, trigger: str) -> Transition:
    """查转移表；不存在则抛 InvalidTransition。"""
    t = _TRANSITION_MAP.get((from_status, trigger))
    if t is None:
        raise InvalidTransition(from_status, trigger)
    return t


def can_transition(from_status: str, trigger: str) -> bool:
    """检查转移是否合法（不抛异常）。"""
    return (from_status, trigger) in _TRANSITION_MAP


def next_status(from_status: str, trigger: str) -> str:
    """便捷方法：返回目标状态。"""
    return get_transition(from_status, trigger).to_status
