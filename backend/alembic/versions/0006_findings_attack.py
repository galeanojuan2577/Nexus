"""Add ATT&CK columns to findings.

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | list[str] | None = None
depends_on: str | list[str] | None = None


def upgrade() -> None:
    op.add_column(
        "findings",
        sa.Column("attack_technique", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "findings",
        sa.Column("attack_tactic", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "findings",
        sa.Column("attack_tactic_id", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("findings", "attack_tactic_id")
    op.drop_column("findings", "attack_tactic")
    op.drop_column("findings", "attack_technique")
