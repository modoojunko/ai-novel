from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

# codes 行状态：待激活/排队中/消耗中/退款冻结/已回收
# merge 只看"已激活族"（active/queued），跳过 revoked/frozen/pending_activation
_ACTIVE_STATUSES = {"active", "queued", "consuming"}


@dataclass
class License:
    """License 聚合：合并用户所有已激活权益的到期日与套餐。"""
    username: str
    max_expires_at: datetime | None = None
    effective_tier: str = "none"

    def is_valid(self) -> bool:
        """License 是否在有效期内（按日期比较，忽略时间）。"""
        if self.max_expires_at is None:
            return False
        return self.max_expires_at.date() >= date.today()

    def merge(self, codes: list) -> License:
        """从 codes 列表计算到期日和 tier。

        2026-08-30 改造（s-pay-foundation task 2.4）：
        - 跳过 revoked（退款回收）和 frozen（退款冻结）行
        - 跳过 pending_activation（囤单不占额度）
        - tier 归属：已激活行中按档位等级取最高（不再按到期最晚）
        - 支持新状态名（queued/consuming）与旧状态名（active/unused）
        """
        from app.domain.payments.pricing import normalize_tier, tier_rank

        max_exp = None
        best_tier = "none"
        best_rank = 0

        for c in codes:
            status = getattr(c, "status", "active")
            # 跳过不可用行
            if status in ("revoked", "frozen", "pending_activation"):
                continue

            expires = getattr(c, "expires_at", None)
            if expires and (max_exp is None or expires > max_exp):
                max_exp = expires

            tier = normalize_tier(getattr(c, "tier", "none"))
            rank = tier_rank(tier)
            if rank > best_rank:
                best_rank = rank
                best_tier = tier

        self.max_expires_at = max_exp
        self.effective_tier = best_tier if max_exp else "none"
        return self
