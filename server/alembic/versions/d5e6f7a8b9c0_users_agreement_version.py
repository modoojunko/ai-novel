"""users.agreement_version: 注册协议版本留痕（legal-four-docs）

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-08-31 07:20:00.000000

幂等：列已存在时跳过。
"""
import sqlalchemy as sa

from alembic import op

revision: str = 'd5e6f7a8b9c0'
down_revision: str | None = 'c4d5e6f7a8b9'
branch_labels: str | None = None
depends_on: str | None = None

_TABLE = 'users'
_COL = 'agreement_version'


def _has_column(insp) -> bool:
    cols = [c["name"] for c in insp.get_columns(_TABLE)]
    return _COL in cols


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not _has_column(insp):
        op.add_column(_TABLE, sa.Column(_COL, sa.String(length=32), server_default='', nullable=True))


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_column(insp):
        op.drop_column(_TABLE, _COL)
