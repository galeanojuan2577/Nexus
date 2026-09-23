"""Add ATT&CK columns to findings

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-23

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("findings", sa.Column("attack_technique", sa.String(32), nullable=True))
    op.add_column("findings", sa.Column("attack_tactic", sa.String(64), nullable=True))
    op.add_column("findings", sa.Column("attack_tactic_id", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("findings", "attack_tactic_id")
    op.drop_column("findings", "attack_tactic")
    op.drop_column("findings", "attack_technique")
