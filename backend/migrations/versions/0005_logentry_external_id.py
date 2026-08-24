"""log_entries.external_id for sync dedup

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-24

Adds a nullable external identifier to log entries so OpenRouter usage-sync
can dedupe across re-syncs: each imported entry stores the provider's
generation ID; a partial unique index (external_id IS NOT NULL) lets manual
entries keep NULL without blocking.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "log_entries",
        sa.Column("external_id", sa.String(length=200), nullable=True),
    )
    # Partial index: only non-null values participate. SQLite supports this
    # via a WHERE clause on the index.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_log_entries_external_id "
        "ON log_entries (external_id) WHERE external_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_log_entries_external_id")
    op.drop_column("log_entries", "external_id")
