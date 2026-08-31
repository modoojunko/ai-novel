"""monthly_tax_report（月度计税报表——报税不等发票，发票暂缓不影响本报表）。

设计依据：backend-detail-design.md §4.15。
数据源 orders（含 refund_* 列族）；演练白名单用户排除（数据不进税表）。
输出 JSON + CSV 文本；落 trade_events: report.monthly_exported。
"""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone

from app.config import settings
from app.infrastructure.repositories.payments_repo import OrderRepo, TradeEventRepo

from app.application.payments.reconcile import BEIJING_TZ, rehearsal_user_ids


def monthly_tax_report(
    db,
    order_repo: OrderRepo,
    event_repo: TradeEventRepo,
    month: str,
) -> dict:
    """汇总月度资金流水。month 形如 '2026-08'（北京时间自然月）。

    Returns:
        {month, gross_fen, refund_fen, net_fen, pay_count, refund_count,
         tax_exempt_note, items:[...], csv}
    """
    year, mon = (int(p) for p in month.split("-"))
    start_bj = datetime(year, mon, 1, tzinfo=BEIJING_TZ)
    if mon == 12:
        end_bj = datetime(year + 1, 1, 1, tzinfo=BEIJING_TZ)
    else:
        end_bj = datetime(year, mon + 1, 1, tzinfo=BEIJING_TZ)
    start = start_bj.astimezone(timezone.utc)
    end = end_bj.astimezone(timezone.utc)

    exclude_ids = rehearsal_user_ids(db)

    # 实收：窗口内支付成功（流水全额口径，手续费不冲减）；exception 冻结单不进报表
    pays = [o for o in order_repo.find_paid_between(start, end)
            if o.get("user_id") not in exclude_ids]
    # 退款：窗口内退款成功
    refunds = [o for o in order_repo.find_refund_succeeded_between(start, end)
               if o.get("user_id") not in exclude_ids]

    gross_fen = sum(o["amount_fen"] for o in pays)
    refund_fen = sum(o.get("refund_amount_fen") or 0 for o in refunds)
    net_fen = gross_fen - refund_fen

    # 逐笔流水（按订单维度聚合正/负项，均可下钻到 trade_events）
    items: dict[str, dict] = {}
    for o in pays:
        items[o["order_no"]] = {
            "order_no": o["order_no"],
            "paid_at": _iso(o.get("paid_at")),
            "amount_fen": o["amount_fen"],
            "refund_fen": 0,
            "transaction_id": o.get("transaction_id") or "",
        }
    for o in refunds:
        row = items.setdefault(o["order_no"], {
            "order_no": o["order_no"], "paid_at": _iso(o.get("paid_at")),
            "amount_fen": o["amount_fen"], "refund_fen": 0,
            "transaction_id": o.get("transaction_id") or "",
        })
        row["refund_fen"] = o.get("refund_amount_fen") or 0

    ordered = sorted(items.values(), key=lambda r: r["paid_at"] or "")

    exempt_note = ""
    if net_fen < settings.TAX_EXEMPT_THRESHOLD_FEN:
        exempt_note = "未超小规模免税额度"

    event_repo.append({
        "event_key": f"report.monthly:{month}:{int(datetime.now(timezone.utc).timestamp())}",
        "event_type": "report.monthly_exported",
        "operator": "admin",
        "payload": {"month": month, "gross_fen": gross_fen,
                    "refund_fen": refund_fen, "net_fen": net_fen},
    })

    return {
        "month": month,
        "gross_fen": gross_fen,
        "refund_fen": refund_fen,
        "net_fen": net_fen,
        "pay_count": len(pays),
        "refund_count": len(refunds),
        "tax_exempt_note": exempt_note,
        "items": ordered,
        "csv": _to_csv(ordered),
    }


def _to_csv(items: list[dict]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["order_no", "paid_at", "amount_fen", "refund_fen", "transaction_id"])
    for r in items:
        writer.writerow([r["order_no"], r["paid_at"], r["amount_fen"],
                         r["refund_fen"], r["transaction_id"]])
    return buf.getvalue()


def _iso(value) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value or "")
