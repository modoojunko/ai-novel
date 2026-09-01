"""daily_reconcile（T4：日对账——宏观收敛层）。

设计依据：backend-detail-design.md §4.13。
三键比对（商户单号/交易单号/金额）内部账 ↔ 网关账单；
mock 网关 → 记 skipped 结束（Change 1）；mismatch/error → NotifyService 告警。
全部幂等：同 bill_date 重跑 = 报表覆盖重算 + trade_events 以 attempt 序号区分。
"""
from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any

from app.config import settings
from app.infrastructure.payments.gateway import MockPaymentGateway, PaymentGateway
from app.infrastructure.repositories.payments_repo import (
    OrderRepo,
    ReconciliationReportRepo,
    TradeEventRepo,
)

logger = logging.getLogger("app.reconcile")

BEIJING_TZ = timezone(timedelta(hours=8))  # 对账窗口按北京时间自然日（账单口径）


def _bill_window(bill_date: str) -> tuple[datetime, datetime]:
    """北京时间自然日 → UTC [start, end) 区间（库内时间为 UTC）。"""
    d = date.fromisoformat(bill_date)
    start_bj = datetime(d.year, d.month, d.day, tzinfo=BEIJING_TZ)
    return start_bj.astimezone(UTC), (start_bj + timedelta(days=1)).astimezone(UTC)


def rehearsal_user_ids(db) -> set[int]:
    """演练白名单用户名 → user_id 集合（对账/计税排除用）。"""
    names = [n.strip() for n in settings.PAYMENTS_REHEARSAL_USERNAMES.split(",") if n.strip()]
    if not names:
        return set()
    from sqlalchemy.orm import Session
    if isinstance(db, Session):
        from app.models.user import UserORM
        rows = db.query(UserORM.id).filter(UserORM.username.in_(names)).all()
        return {r[0] for r in rows}
    # pg_http
    client = db
    out: set[int] = set()
    for name in names:
        row = client.find_one("users", {"username": name})
        if row and row.get("id") is not None:
            out.add(int(row["id"]))
    return out


def daily_reconcile(
    db,
    gateway: PaymentGateway,
    order_repo: OrderRepo,
    event_repo: TradeEventRepo,
    report_repo: ReconciliationReportRepo,
    notify: Any = None,
    bill_date: str | None = None,
) -> dict:
    """T4 日对账。bill_date 缺省=昨天（北京时间）。返回报表摘要 dict。"""
    if bill_date is None:
        bill_date = (datetime.now(BEIJING_TZ) - timedelta(days=1)).date().isoformat()

    # ── mock 网关：记 skipped 结束（Change 1 阶段，对账管道占位）──
    if isinstance(gateway, MockPaymentGateway):
        report_repo.upsert({
            "bill_date": bill_date,
            "status": "skipped",
            "internal_count": 0, "wx_count": 0,
            "internal_total_fen": 0, "wx_total_fen": 0,
            "refund_count": 0, "refund_total_fen": 0,
            "mismatch_detail": [],
        })
        return {"bill_date": bill_date, "status": "skipped"}

    exclude_ids = rehearsal_user_ids(db)

    # ── 拉账单（重试 3 次；历史可重拉，失败不阻塞后续补跑）──
    try:
        trade_lines: list = _with_retry(lambda: gateway.download_bill(bill_date))
    except Exception as e:  # noqa: BLE001
        logger.warning("event=reconcile.bill_download_fail bill_date=%s error=%s", bill_date, e)
        report_repo.upsert({
            "bill_date": bill_date, "status": "error",
            "internal_count": 0, "wx_count": 0,
            "internal_total_fen": 0, "wx_total_fen": 0,
            "refund_count": 0, "refund_total_fen": 0,
            "mismatch_detail": [],
        })
        _notify(notify, f"对账账单下载失败 {bill_date}", f"网关账单拉取重试后仍失败：{e}")
        return {"bill_date": bill_date, "status": "error"}

    start, end = _bill_window(bill_date)

    # ── 内部账（排除演练白名单用户）──
    pays = [o for o in order_repo.find_paid_between(start, end)
            if o.get("user_id") not in exclude_ids]
    refunds = [o for o in order_repo.find_refund_succeeded_between(start, end)
               if o.get("user_id") not in exclude_ids]

    # ── 三键比对：商户单号（order_no）/交易单号/金额 ──
    wx_pay = {ln.out_trade_no: ln for ln in trade_lines if ln.status == "SUCCESS"}
    wx_refund = {ln.out_trade_no: ln for ln in trade_lines if ln.status == "REFUND"}

    mismatches: list[dict] = []
    for o in pays:
        ln = wx_pay.pop(o["order_no"], None)
        if ln is None:
            mismatches.append({"kind": "local_only", "order_no": o["order_no"],
                               "amount_fen": o["amount_fen"]})
        elif ln.amount_fen != o["amount_fen"]:
            mismatches.append({"kind": "amount_diff", "order_no": o["order_no"],
                               "internal_fen": o["amount_fen"], "wx_fen": ln.amount_fen})
    for o in refunds:
        ln = wx_refund.pop(o["order_no"], None)
        if ln is None:
            mismatches.append({"kind": "local_refund_only", "order_no": o["order_no"],
                               "refund_fen": o.get("refund_amount_fen")})
        elif ln.amount_fen != (o.get("refund_amount_fen") or 0):
            mismatches.append({"kind": "refund_amount_diff", "order_no": o["order_no"],
                               "internal_fen": o.get("refund_amount_fen"), "wx_fen": ln.amount_fen})
    for order_no, ln in wx_pay.items():
        mismatches.append({"kind": "wx_only", "order_no": order_no,
                           "wx_fen": ln.amount_fen,
                           "note": "漏单/异常收款/exception 未处置"})
    for order_no, ln in wx_refund.items():
        mismatches.append({"kind": "wx_refund_only", "order_no": order_no,
                           "wx_fen": ln.amount_fen})

    internal_pay_fen = sum(o["amount_fen"] for o in pays)
    wx_pay_fen = sum(ln.amount_fen for ln in trade_lines if ln.status == "SUCCESS")
    internal_refund_fen = sum(o.get("refund_amount_fen") or 0 for o in refunds)
    wx_refund_fen = sum(ln.amount_fen for ln in trade_lines if ln.status == "REFUND")

    status = "mismatch" if mismatches else "balanced"
    report_repo.upsert({
        "bill_date": bill_date,
        "status": status,
        "internal_count": len(pays),
        "wx_count": sum(1 for ln in trade_lines if ln.status == "SUCCESS"),
        "internal_total_fen": internal_pay_fen,
        "wx_total_fen": wx_pay_fen,
        "refund_count": len(refunds),
        "refund_total_fen": internal_refund_fen,
        "mismatch_detail": mismatches,
    })

    event_repo.append({
        "event_key": f"reconcile.completed:{bill_date}:attempt:{_now_stamp()}",
        "event_type": "reconcile.completed",
        "payload": {"bill_date": bill_date, "status": status,
                    "mismatch_count": len(mismatches)},
    })

    if status == "mismatch":
        top10 = "\n".join(str(m) for m in mismatches[:10])
        _notify(notify, f"对账不平 {bill_date}（{len(mismatches)} 笔）", top10)

    return {"bill_date": bill_date, "status": status, "mismatches": mismatches}


def _with_retry(fn, attempts: int = 3):
    """指数退避重试（测试环境 sleep 注入为 0 也不影响正确性）。"""
    import time
    last: Exception | None = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            last = e
            if i < attempts - 1:
                time.sleep(min(2 ** i, 4))
    raise last  # type: ignore[misc]


def _now_stamp() -> int:
    return int(datetime.now(UTC).timestamp())


def _notify(notify: Any, title: str, markdown: str) -> None:
    if notify is not None:
        notify.send(title, markdown)
