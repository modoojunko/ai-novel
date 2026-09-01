"""codes.refund_requested_at: 权益级退款申请（account-deletion）

Revision ID: c4d5e6f7a8b9
Revises: a1b2c3d4e5f6
Create Date: 2026-08-31 07:10:00.000000

幂等：列已存在时跳过（SQLite / PG 通用，靠 inspection 而非方言 DDL）。
"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: str | None = 'a002_payments_tables'
branch_labels: str | None = None
depends_on: str | None = None

_TABLE = 'codes'
_COL = 'refund_requested_at'


def _has_column(insp) -> bool:
    cols = [c["name"] for c in insp.get_columns(_TABLE)]
    return _COL in cols


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not _has_column(insp):
        op.add_column(_TABLE, sa.Column(_COL, sa.DateTime(), nullable=True))


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_column(insp):
        op.drop_column(_TABLE, _COL)
