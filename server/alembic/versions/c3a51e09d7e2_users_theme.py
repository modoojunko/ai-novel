"""users.theme: 界面主题偏好（theme-preferences）

Revision ID: c3a51e09d7e2
Revises: bb1fcc46b21f
Create Date: 2026-08-28 21:05:00.000000

幂等：列已存在时跳过（SQLite / PG 通用，靠 inspection 而非方言 DDL）。
"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c3a51e09d7e2'
down_revision: str | None = 'bb1fcc46b21f'
branch_labels: str | None = None
depends_on: str | None = None

_TABLE = 'users'
_COL = 'theme'


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
