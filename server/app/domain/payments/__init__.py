"""payments 领域层：状态机 + 折算 + 定价 + tier 归属。"""
from app.domain.payments.order import (
    ALL_STATUSES, CLOSED, EXCEPTION, FULFILLED, PAID, PENDING,
    REFUNDED, REFUND_PENDING, REFUND_PROCESSING,
    InvalidTransition, Transition, can_transition,
    get_transition, next_status,
)
from app.domain.payments.pricing import (
    COOLDOWN_SECONDS, SkuSnapshot,
    ActivationBusyError, AgreementStaleError, DomainError,
    NotActivatableError, PurchaseDisabledError, RefundAlreadyActiveError,
    RefundTooSmallError, RefundWindowExceeded, SkuNotFoundError,
    calc_cooldown_ends_at, calc_discount_display, calc_price_fen,
    gen_order_no, normalize_tier, resolve_effective_tier, tier_rank,
)
from app.domain.payments.refund import (
    REASON_BELOW_ONE_FEN, REASON_IN_PROGRESS, REASON_NOT_PAID,
    REASON_OVER_ONE_YEAR, RefundQuote, calc_refund_fen,
)

__all__ = [
    # 状态机
    "ALL_STATUSES", "CLOSED", "EXCEPTION", "FULFILLED", "PAID", "PENDING",
    "REFUNDED", "REFUND_PENDING", "REFUND_PROCESSING",
    "InvalidTransition", "Transition", "can_transition",
    "get_transition", "next_status",
    # 定价
    "COOLDOWN_SECONDS", "SkuSnapshot",
    "ActivationBusyError", "AgreementStaleError", "DomainError",
    "NotActivatableError", "PurchaseDisabledError", "RefundAlreadyActiveError",
    "RefundTooSmallError", "RefundWindowExceeded", "SkuNotFoundError",
    "calc_cooldown_ends_at", "calc_discount_display", "calc_price_fen",
    "gen_order_no", "normalize_tier", "resolve_effective_tier", "tier_rank",
    # 退款折算
    "REASON_BELOW_ONE_FEN", "REASON_IN_PROGRESS", "REASON_NOT_PAID",
    "REASON_OVER_ONE_YEAR", "RefundQuote", "calc_refund_fen",
]
