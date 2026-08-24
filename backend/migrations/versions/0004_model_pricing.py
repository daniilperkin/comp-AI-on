"""model pricing columns

Revision ID: 0004
Revises: 0002
Create Date: 2026-08-24

Adds optional per-model token prices (USD per million tokens) so log entries
without an explicit cost_usd can still contribute to spend analytics. Both
columns are nullable — unknown pricing simply means derived cost is None.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "models",
        sa.Column("input_price_per_mtok", sa.Float(), nullable=True),
    )
    op.add_column(
        "models",
        sa.Column("output_price_per_mtok", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("models", "output_price_per_mtok")
    op.drop_column("models", "input_price_per_mtok")
