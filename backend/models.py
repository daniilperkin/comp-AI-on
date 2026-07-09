from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


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
    name: str
    kind: ModelKind = Field(default=ModelKind.web)
    vendor: Optional[str] = None
    is_active: bool = Field(default=True)


class Model(ModelBase, table=True):
    __tablename__ = "models"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ModelCreate(ModelBase):
    pass


class ModelUpdate(SQLModel):
    name: Optional[str] = None
    kind: Optional[ModelKind] = None
    vendor: Optional[str] = None
    is_active: Optional[bool] = None


# ---- Category ----

class CategoryBase(SQLModel):
    name: str
    color: Optional[str] = None


class Category(CategoryBase, table=True):
    __tablename__ = "categories"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(SQLModel):
    name: Optional[str] = None
    color: Optional[str] = None


# ---- LogEntry ----

class LogEntryBase(SQLModel):
    model_id: Optional[int] = Field(default=None, foreign_key="models.id")
    model_name_text: Optional[str] = None
    category_id: Optional[int] = Field(default=None, foreign_key="categories.id")
    category_name_text: Optional[str] = None
    task_description: Optional[str] = None
    quality_score: Optional[int] = Field(default=None, ge=1, le=10)
    outcome: Optional[Outcome] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost_usd: Optional[float] = None
    latency_ms: Optional[int] = None
    notes: Optional[str] = None


class LogEntry(LogEntryBase, table=True):
    __tablename__ = "log_entries"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class LogEntryCreate(LogEntryBase):
    pass


class LogEntryUpdate(SQLModel):
    model_id: Optional[int] = None
    model_name_text: Optional[str] = None
    category_id: Optional[int] = None
    category_name_text: Optional[str] = None
    task_description: Optional[str] = None
    quality_score: Optional[int] = Field(default=None, ge=1, le=10)
    outcome: Optional[Outcome] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost_usd: Optional[float] = None
    latency_ms: Optional[int] = None
    notes: Optional[str] = None


# ---- Setting ----

class Setting(SQLModel, table=True):
    __tablename__ = "settings"

    key: str = Field(primary_key=True)
    value: str = Field(default="")
