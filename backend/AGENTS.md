# backend/AGENTS.md — Backend Guide

> Read the root `AGENTS.md` first for project-wide conventions.
> This file covers backend-specific patterns and tasks.

## Quick Reference

| Task | Where to look |
|---|---|
| Add a new SQLModel table | `models.py` — follow the base-class pattern |
| Add a new API endpoint | `routers/<resource>.py` + register in `main.py` |
| Add seed data | `seed.py` → `run_seed()` |
| Change DB location | `db.py` → `DB_PATH` |
| Add Python dependency | `requirements.txt` + `pip install` in venv |

## Architecture

```
backend/
├── __init__.py        # Makes `backend` a Python package
├── main.py            # FastAPI app, lifespan (init_db), router registration, static mount
├── db.py              # SQLAlchemy engine, get_session() dependency, init_db()
├── config.py          # Configuration and settings
├── models.py          # ALL SQLModel tables + Base/Create/Update schemas
├── notify.py          # Notification handlers
├── scheduler.py       # APScheduler configuration
├── seed.py            # Default seed data (models, categories, settings)
├── requirements.txt   # Python deps
├── ruff.toml          # Ruff linter config
├── database.db        # SQLite file (auto-generated, gitignored)
├── tests/             # Tests directory
└── routers/
    ├── __init__.py
    ├── categories.py   # Category CRUD
    ├── compare.py      # Model comparison endpoints
    ├── logs.py         # LogEntry CRUD
    ├── models.py       # Model CRUD
    ├── notifications.py# Notification endpoints
    ├── recommend.py    # Recommender endpoints
    ├── stats.py        # Stats/analytics endpoints
    └── settings.py     # Settings GET/PUT
```

## SQLModel Pattern (CRITICAL)

**ALWAYS** use the base-class pattern. Never inherit `table=True` in Create/Update schemas.

```python
# CORRECT
class ModelBase(SQLModel):
    name: str
    kind: ModelKind = Field(default=ModelKind.web)

class Model(ModelBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ModelCreate(ModelBase):
    pass

class ModelUpdate(SQLModel):
    name: Optional[str] = None
    kind: Optional[ModelKind] = None

# WRONG — causes AttributeError at runtime
class ModelCreate(Model, table=True):  # NEVER DO THIS
    pass
```

## Adding a New Table

1. In `models.py`, define `Base`, `Table(table=True)`, `Create`, and `Update` classes following the pattern above.
2. If seed data is needed, add it to `seed.py` → `run_seed()`.
3. The table is auto-created on next startup via `SQLModel.metadata.create_all(engine)`.

## Adding a New Router

1. Create `routers/<resource>.py`:
   ```python
   from fastapi import APIRouter, Depends
   from sqlmodel import Session, select
   from backend.db import get_session
   from backend.models import MyModel, MyModelCreate

   router = APIRouter(prefix="/api/myresource", tags=["myresource"])

   @router.get("")
   def list_items(session: Session = Depends(get_session)):
       return session.exec(select(MyModel)).all()
   ```
2. Register in `main.py`:
   ```python
   from backend.routers import myresource
   app.include_router(myresource.router)
   ```

## Endpoint Conventions

- Prefix: `/api/<resource>` (plural)
- Tags: `["<resource>"]`
- List endpoint: `GET ""` (empty path, returns array)
- Create: `POST ""` (status 201)
- Single item: `GET/PATCH/DELETE "/{id}"`
- Return SQLModel instances directly — FastAPI serializes them.
- Use `exclude_unset=True` on `.model_dump()` for PATCH (partial updates).

## Query Patterns

```python
# Filtered list
stmt = select(LogEntry).where(LogEntry.model_id == model_id).order_by(LogEntry.created_at.desc())

# Aggregation
from sqlmodel import func
count = session.exec(select(func.count(LogEntry.id))).one()
avg = session.exec(select(func.avg(LogEntry.quality_score))).one()

# Group by
rows = session.exec(
    select(LogEntry.model_id, func.avg(LogEntry.quality_score))
    .group_by(LogEntry.model_id)
).all()
```

## Database Reset

Delete `backend/database.db` and restart. `init_db()` in `db.py` calls:
1. `SQLModel.metadata.create_all(engine)` — creates all tables
2. `run_seed(session)` — inserts seed data if tables are empty

## Running the Backend

```powershell
# Must set PYTHONPATH to repo root (absolute imports)
set PYTHONPATH=C:\Users\danyo\Desktop\Uni\comp[AI]on
backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8765
```

## Dependencies

Current (`requirements.txt`):
- `fastapi` — web framework
- `uvicorn[standard]` — ASGI server
- `sqlmodel` — ORM (SQLAlchemy + Pydantic)
- `pydantic-settings` — settings management
- `apscheduler` — notification scheduler
- `alembic` — database migrations
- `httpx` — webhook calls
- `ruff` — code linter
- `pytest` — testing framework

## Production Mode

When `frontend/dist/` exists, `main.py` mounts it as static files and serves the SPA with a catch-all fallback to `index.html`. This means in production, you only run the backend — it serves both API and frontend.

## CORS

Only enabled for dev (`localhost:6769`). In production, same-origin — no CORS needed.
