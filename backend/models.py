from datetime import UTC, datetime
from enum import Enum

from pydantic import NaiveDatetime
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    """Naive UTC timestamp.

    ``datetime.utcnow()`` is deprecated in Python 3.12+. We keep the DB column
    naive (the scheduler and stats compare against naive UTC), so we strip the
    tzinfo from an aware ``datetime.now(timezone.utc)``.
    """
    return datetime.now(UTC).replace(tzinfo=None)


class ModelKind(str, Enum):
    local = "local"
    web = "web"
    agentic = "agentic"


class Outcome(str, Enum):
    solved = "solved"
    partial = "partial"
    failed = "failed"


# ---- Model ----

class ModelBase(SQLModel):
    name: str = Field(max_length=100)
    kind: ModelKind = Field(default=ModelKind.web)
    vendor: str | None = Field(default=None, max_length=100)
    is_active: bool = Field(default=True)
    # USD per million tokens — optional; enables derived cost when a log entry
    # has token counts but no explicit cost_usd.
    input_price_per_mtok: float | None = Field(default=None, ge=0)
    output_price_per_mtok: float | None = Field(default=None, ge=0)


class Model(ModelBase, table=True):
    __tablename__ = "models"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=100, unique=True)
    created_at: NaiveDatetime = Field(default_factory=_utcnow)


class ModelCreate(ModelBase):
    pass


class ModelUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=100)
    kind: ModelKind | None = None
    vendor: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None
    input_price_per_mtok: float | None = Field(default=None, ge=0)
    output_price_per_mtok: float | None = Field(default=None, ge=0)


# ---- Category ----

class CategoryBase(SQLModel):
    name: str = Field(max_length=100)
    color: str | None = Field(default=None, max_length=32)


class Category(CategoryBase, table=True):
    __tablename__ = "categories"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=100, unique=True)
    created_at: NaiveDatetime = Field(default_factory=_utcnow)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=32)


# ---- LogEntry ----

class LogEntryBase(SQLModel):
    model_id: int | None = Field(default=None, foreign_key="models.id")
    model_name_text: str | None = Field(default=None, max_length=200)
    category_id: int | None = Field(default=None, foreign_key="categories.id")
    category_name_text: str | None = Field(default=None, max_length=100)
    task_description: str | None = Field(default=None, max_length=500)
    session_title: str | None = Field(default=None, max_length=200)
    quality_score: int | None = Field(default=None, ge=1, le=10)
    outcome: Outcome | None = None
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    cache_read_tokens: int | None = Field(default=None, ge=0)
    cache_write_tokens: int | None = Field(default=None, ge=0)
    reasoning_tokens: int | None = Field(default=None, ge=0)
    cost_usd: float | None = Field(default=None, ge=0)
    latency_ms: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=4000)
    # Provider-side identifier (e.g. OpenRouter generation ID) for entries
    # imported via usage sync; NULL for manually logged entries. The partial
    # unique index on it makes re-syncs idempotent.
    external_id: str | None = Field(default=None, max_length=200)


class LogEntry(LogEntryBase, table=True):
    __tablename__ = "log_entries"

    id: int | None = Field(default=None, primary_key=True)
    created_at: NaiveDatetime = Field(default_factory=_utcnow, index=True)
    # Provenance: "manual" | "openrouter" | "hermes". Set server-side only.
    origin: str | None = Field(default=None, max_length=32, index=True)


class LogEntryCreate(LogEntryBase):
    pass


class LogEntryUpdate(SQLModel):
    model_id: int | None = None
    model_name_text: str | None = Field(default=None, max_length=200)
    category_id: int | None = None
    category_name_text: str | None = Field(default=None, max_length=100)
    task_description: str | None = Field(default=None, max_length=500)
    session_title: str | None = Field(default=None, max_length=200)
    quality_score: int | None = Field(default=None, ge=1, le=10)
    outcome: Outcome | None = None
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    cache_read_tokens: int | None = Field(default=None, ge=0)
    cache_write_tokens: int | None = Field(default=None, ge=0)
    reasoning_tokens: int | None = Field(default=None, ge=0)
    cost_usd: float | None = Field(default=None, ge=0)
    latency_ms: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=4000)


# ---- Setting ----

class Setting(SQLModel, table=True):
    __tablename__ = "settings"

    key: str = Field(primary_key=True, max_length=64)
    value: str = Field(default="", max_length=500)


# ---- Notification ----

class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: int | None = Field(default=None, primary_key=True)
    created_at: NaiveDatetime = Field(default_factory=_utcnow, index=True)
    title: str = Field(max_length=200)
    body: str = Field(max_length=1000)
    channel: str = Field(default="browser", max_length=32)
    shown: bool = Field(default=False)
