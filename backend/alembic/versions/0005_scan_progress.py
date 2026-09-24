"""Add scan progress, level, interpretation columns

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-23

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("scans", sa.Column("level", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("scans", sa.Column("progress", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("scans", sa.Column("stage", sa.String(100), nullable=True))
    op.add_column("scans", sa.Column("interpretation", sa.Text(), nullable=True))
    op.add_column("scans", sa.Column("error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("scans", "error")
    op.drop_column("scans", "interpretation")
    op.drop_column("scans", "stage")
    op.drop_column("scans", "progress")
    op.drop_column("scans", "level")
