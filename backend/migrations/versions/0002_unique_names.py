"""unique names

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-18

Adds unique indexes on models.name and categories.name so duplicate model or
category records cannot be created. SQLite does not support ADD CONSTRAINT, so
we use CREATE UNIQUE INDEX (idempotent via IF NOT EXISTS). If duplicates exist
this migration will fail with a clear error; clean them up before retrying.
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_models_name ON models (name)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_name ON categories (name)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_categories_name")
    op.execute("DROP INDEX IF EXISTS ux_models_name")
