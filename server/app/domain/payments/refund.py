"""退款折算纯函数：秒级精确 + clamp + 封顶 + 分币地板。

设计依据：backend-detail-design.md §3.3。
纪要终版：按秒折算、金额四舍五入到分、不足 1 分拒退、未激活/排队中全额退。
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class RefundQuote:
    """退款折算结果。"""
    refundable: bool
    refund_fen: int          # 退款金额（分）
    reason: str              # 不可退原因（refundable=False 时非空）
    remaining_sec: int       # 剩余秒数（信息性，前端展示用）
    remaining_desc: str      # 人类可读剩余时长


# 拒退原因枚举（附录 Z 对齐）
REASON_BELOW_ONE_FEN = "below_one_fen"      # 剩余不足 1 分
REASON_OVER_ONE_YEAR = "over_one_year"      # 超微信退款窗口
REASON_NOT_PAID = "not_paid"                # 非已支付态
REASON_IN_PROGRESS = "in_progress"           # 已有进行中退款


def _round_half_up(numerator: int, denominator: int) -> int:
    """整数四舍五入（half up）：(num + den//2) // den。仅用于正数。"""
    return (numerator + denominator // 2) // denominator


def _format_remaining(sec: int) -> str:
    """秒 → 人类可读「X 天 Y 小时 Z 分」。"""
    days, rem = divmod(sec, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    parts = []
    if days:
        parts.append(f"{days} 天")
    if hours:
        parts.append(f"{hours} 小时")
    if minutes or not parts:
        parts.append(f"{minutes} 分")
    return " ".join(parts)


def calc_refund_fen(
    amount_fen: int,
    total_sec: int,
    expires_at: datetime,
    grant_start: datetime | None,
    refund_at: datetime,
    paid_at: datetime,
) -> RefundQuote:
    """退款折算。

    Args:
        amount_fen:    订单冻结实付（分）
        total_sec:     套餐总时长（秒）
        expires_at:    到期时刻（UTC）
        grant_start:   起算时刻（UTC）；None=未激活（全额退）
        refund_at:     确认退款时刻（UTC）
        paid_at:       支付时刻（UTC，用于窗口判断）

    Returns:
        RefundQuote
    """
    # 超微信退款窗口（支付后 1 年）
    one_year_sec = 365 * 86400
    if (refund_at - paid_at).total_seconds() > one_year_sec:
        return RefundQuote(False, 0, REASON_OVER_ONE_YEAR, 0, "")

    # 未激活 / 排队中（grant_start 为 None 或在未来）→ 全额退
    if grant_start is None or grant_start > refund_at:
        return RefundQuote(True, amount_fen, "", total_sec,
                           f"未激活，全额退")

    # 已消耗：计算剩余秒数（clamp 到 [0, expires_at - max(refund_at, grant_start)]）
    clamp_start = max(refund_at, grant_start)
    remaining_sec = int((expires_at - clamp_start).total_seconds())
    if remaining_sec <= 0:
        return RefundQuote(False, 0, REASON_BELOW_ONE_FEN, 0, "已到期")

    # 按秒折算：refund = amount × remaining / total，四舍五入到分
    refund_fen = _round_half_up(amount_fen * remaining_sec, total_sec)

    # 分币地板：不足 1 分拒退
    if refund_fen < 1:
        return RefundQuote(False, 0, REASON_BELOW_ONE_FEN, remaining_sec,
                           _format_remaining(remaining_sec))

    # 封顶：不超过实付
    refund_fen = min(refund_fen, amount_fen)
    return RefundQuote(True, refund_fen, "", remaining_sec,
                       _format_remaining(remaining_sec))
