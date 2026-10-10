"""log_entries cache/reasoning token buckets + origin

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-09

Adds cache and reasoning token buckets plus a provenance marker to log
entries. The Hermes usage sync stores Hermes' full token accounting (cache
reads are the bulk of input volume and priced differently, so folding them
into input_tokens would distort spend math), and origin lets stats/UI tell
manually logged rows apart from imported ones (manual | openrouter | hermes).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("log_entries", sa.Column("cache_read_tokens", sa.Integer(), nullable=True))
    op.add_column("log_entries", sa.Column("cache_write_tokens", sa.Integer(), nullable=True))
    op.add_column("log_entries", sa.Column("reasoning_tokens", sa.Integer(), nullable=True))
    op.add_column("log_entries", sa.Column("origin", sa.String(length=32), nullable=True))
    op.create_index("ix_log_entries_origin", "log_entries", ["origin"])
    # Backfill: rows carrying a provider external_id came from the OpenRouter
    # sync; every other row was logged by hand.
    op.execute("UPDATE log_entries SET origin = 'openrouter' WHERE external_id IS NOT NULL")
    op.execute("UPDATE log_entries SET origin = 'manual' WHERE origin IS NULL")


def downgrade() -> None:
    op.drop_index("ix_log_entries_origin", table_name="log_entries")
    op.drop_column("log_entries", "origin")
    op.drop_column("log_entries", "reasoning_tokens")
    op.drop_column("log_entries", "cache_write_tokens")
    op.drop_column("log_entries", "cache_read_tokens")
