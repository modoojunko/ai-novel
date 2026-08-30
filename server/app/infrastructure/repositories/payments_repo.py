"""payments 仓储层：order/trade_event/sku/tier 仓储（pg_http + sqlite 双模式）。

表即状态机：OrderRepo.compare_and_transition 是核心 CAS 原语。
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.domain.payments.order import Transition


class OrderRepo:
    """orders 表仓储（含退款列族）。sqlite/pg_http 双模式。"""

    def __init__(self, db):
        self._db = db  # Session（sqlite）或 PgRestClient（pg_http）

    def create(self, order: dict) -> dict | None:
        """INSERT；撞唯一约束返回 None。"""
        if isinstance(self._db, Session):
            from app.models.payments import OrderORM
            orm = OrderORM(**order)
            self._db.add(orm)
            self._db.flush()
            self._db.refresh(orm)
            return {c.name: getattr(orm, c.name) for c in orm.__table__.columns}
        else:
            return self._db.insert_returning("orders", order)

    def find_by_order_no(self, order_no: str) -> dict | None:
        if isinstance(self._db, Session):
            from app.models.payments import OrderORM
            orm = self._db.query(OrderORM).filter_by(order_no=order_no).first()
            if not orm:
                return None
            return {c.name: getattr(orm, c.name) for c in orm.__table__.columns}
        else:
            return self._db.find_one("orders", {"order_no": order_no})

    def find_by_user(self, user_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
        if isinstance(self._db, Session):
            from app.models.payments import OrderORM
            orms = (
                self._db.query(OrderORM)
                .filter_by(user_id=user_id)
                .order_by(OrderORM.created_at.desc())
                .offset(offset).limit(limit).all()
            )
            return [{c.name: getattr(o, c.name) for c in o.__table__.columns} for o in orms]
        else:
            return self._db.find(
                "orders",
                filter={"user_id": user_id},
                sort=[("created_at", "desc")],
                limit=limit,
            )

    def find_pending_expirable(self, cutoff: datetime) -> list[dict]:
        """扫描 pending 且超时的订单（T1 关单）。"""
        if isinstance(self._db, Session):
            from app.models.payments import OrderORM
            from sqlalchemy import and_
            orms = self._db.query(OrderORM).filter(
                and_(OrderORM.status == "pending", OrderORM.created_at < cutoff)
            ).all()
            return [{c.name: getattr(o, c.name) for c in o.__table__.columns} for o in orms]
        else:
            return self._db.find("orders", filter={"status": "pending"})

    def find_paid_unfulfilled(self) -> list[dict]:
        """扫描 paid 但未 fulfilled 的订单（T2 补偿发货）。"""
        if isinstance(self._db, Session):
            from app.models.payments import OrderORM
            orms = self._db.query(OrderORM).filter_by(status="paid").all()
            return [{c.name: getattr(o, c.name) for c in o.__table__.columns} for o in orms]
        else:
            return self._db.find("orders", filter={"status": "paid"})

    def find_cooldown_expired(self, now: datetime) -> list[dict]:
        """扫描冷静期到期的订单（§4.9b 到点提交）。"""
        if isinstance(self._db, Session):
            from app.models.payments import OrderORM
            from sqlalchemy import and_
            orms = self._db.query(OrderORM).filter(
                and_(
                    OrderORM.status == "refund_pending",
                    OrderORM.cooldown_ends_at <= now,
                )
            ).all()
            return [{c.name: getattr(o, c.name) for c in o.__table__.columns} for o in orms]
        else:
            return self._db.find("orders", filter={"status": "refund_pending"})

    def compare_and_transition(
        self, order_no: str, transition: Transition, extra_changes: dict | None = None,
    ) -> dict | None:
        """核心 CAS 原语：执行状态转移，赢返回更新后行，输返回 None。

        Args:
            order_no: 订单号
            transition: 领域层转移定义（含 CAS WHERE 条件）
            extra_changes: 额外要写的列（如 paid_at/cooldown_ends_at）
        """
        changes = {"status": transition.to_status, **(extra_changes or {})}
        if isinstance(self._db, Session):
            from app.models.payments import OrderORM
            from sqlalchemy import and_, or_
            # 解析 CAS WHERE（"status IN ('pending','closed')" 或 "status = 'pending'"）
            conditions = [OrderORM.order_no == order_no]
            if "IN" in transition.cas_where:
                # "status IN ('pending','closed')" → __in__
                values = transition.cas_where.split("IN")[1].strip("() ")
                vals = [v.strip("' ") for v in values.split(",")]
                conditions.append(OrderORM.status.in_(vals))
            elif "=" in transition.cas_where:
                # "status = 'pending'" → ==
                val = transition.cas_where.split("=")[1].strip("' ")
                conditions.append(OrderORM.status == val)

            orm = self._db.query(OrderORM).filter(and_(*conditions)).first()
            if not orm:
                return None
            for k, v in changes.items():
                setattr(orm, k, v)
            self._db.flush()
            self._db.refresh(orm)
            return {c.name: getattr(orm, c.name) for c in orm.__table__.columns}
        else:
            # pg_http：使用 CAS 扩展方法
            # 简化：只用 from_status 做 CAS 条件（复杂条件由调用方预检）
            return self._db.compare_and_update(
                "orders",
                pk_filter={"order_no": order_no},
                cas_condition={"status": transition.from_status},
                changes=changes,
            )

    def update_fields(self, order_no: str, changes: dict) -> None:
        """直接更新指定列（不做 CAS，用于幂等补写）。"""
        if isinstance(self._db, Session):
            from app.models.payments import OrderORM
            self._db.query(OrderORM).filter_by(order_no=order_no).update(changes)
            self._db.flush()
        else:
            self._db.update("orders", {"order_no": order_no}, changes)


class TradeEventRepo:
    """trade_events 仓储（append-only，event_key 幂等）。"""

    def __init__(self, db):
        self._db = db

    def append(self, event: dict) -> bool:
        """INSERT；撞 event_key 唯一约束返回 False（幂等重放）。"""
        if isinstance(self._db, Session):
            from app.models.payments import TradeEventORM
            existing = self._db.query(TradeEventORM).filter_by(
                event_key=event["event_key"]).first()
            if existing:
                return False
            orm = TradeEventORM(**event)
            self._db.add(orm)
            self._db.flush()
            return True
        else:
            return self._db.insert_or_conflict("trade_events", event)

    def find_by_order(self, order_no: str) -> list[dict]:
        if isinstance(self._db, Session):
            from app.models.payments import TradeEventORM
            orms = (
                self._db.query(TradeEventORM)
                .filter_by(order_no=order_no)
                .order_by(TradeEventORM.created_at)
                .all()
            )
            return [{c.name: getattr(o, c.name) for c in o.__table__.columns} for o in orms]
        else:
            return self._db.find(
                "trade_events",
                filter={"order_no": order_no},
                sort=[("created_at", "asc")],
            )


class SkuRepo:
    """skus 仓储。"""

    def __init__(self, db):
        self._db = db

    def find_on_sale(self) -> list[dict]:
        if isinstance(self._db, Session):
            from app.models.payments import SkuORM, TierORM
            rows = (
                self._db.query(SkuORM, TierORM)
                .join(TierORM, SkuORM.tier_id == TierORM.id)
                .filter(SkuORM.on_sale == True, TierORM.status == "live")  # noqa: E712
                .order_by(SkuORM.sort)
                .all()
            )
            result = []
            for sku, tier in rows:
                d = {c.name: getattr(sku, c.name) for c in sku.__table__.columns}
                d["tier_key"] = tier.key
                d["tier_display"] = tier.display_name
                d["tier_rank"] = tier.rank
                result.append(d)
            return result
        else:
            return self._db.find("skus", filter={"on_sale": True}, sort=[("sort", "asc")])

    def find_by_key(self, sku_key: str) -> dict | None:
        if isinstance(self._db, Session):
            from app.models.payments import SkuORM
            orm = self._db.query(SkuORM).filter_by(sku_key=sku_key).first()
            if not orm:
                return None
            return {c.name: getattr(orm, c.name) for c in orm.__table__.columns}
        else:
            return self._db.find_one("skus", {"sku_key": sku_key})


class TierRepo:
    """tiers 仓储。"""

    def __init__(self, db):
        self._db = db

    def find_all(self) -> list[dict]:
        if isinstance(self._db, Session):
            from app.models.payments import TierORM
            orms = self._db.query(TierORM).order_by(TierORM.rank).all()
            return [{c.name: getattr(o, c.name) for c in o.__table__.columns} for o in orms]
        else:
            return self._db.find("tiers", sort=[("rank", "asc")])
