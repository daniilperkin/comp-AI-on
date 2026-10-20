"""log_entries.session_title — the Hermes chat/session name

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-20

Hermes keeps a human-readable title per session; the sync already stuffed it
into notes, but it deserves a first-class column so the History table and the
rate queue can show *what the chat was about* instead of only the model and
the synthetic "auto-imported" task marker. Populated on the next sync for all
existing rows (the upsert field set includes it).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "log_entries", sa.Column("session_title", sa.String(length=200), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("log_entries", "session_title")
