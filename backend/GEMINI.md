# GEMINI.md — comp[AI]on Backend

> **Single source of truth: [`AGENTS.md`](./AGENTS.md) and root [`../AGENTS.md`](../AGENTS.md).**
> This file is a bridge for Gemini/Antigravity agents. Read both AGENTS.md files for the full project guide.

## Quick summary for Antigravity

| Topic | Key info |
|---|---|
| **Stack** | Python 3.11+, FastAPI, SQLModel (SQLAlchemy + Pydantic), SQLite |
| **Setup** | `python -m venv .venv` → `.venv\Scripts\activate` → `pip install -r requirements.txt` |
| **Run** | `uvicorn backend.main:app --reload --port 8765` (with PYTHONPATH set to repo root) |
| **Verify** | `pytest backend/tests/` |
| **Linter** | `ruff check .` in backend/ directory |
| **DB** | Single SQLite file at `backend/database.db` (auto-generated) |

## comp[AI]on-specific gotchas

- **PYTHONPATH** must be set to the repo root. Without it, `from backend.models import ...` will fail.
- **SQLModel base-class pattern ONLY**: never `class FooCreate(Foo, table=True)` — this crashes at runtime. Always separate `Base` (no table), `Table(table=True)`, and `Create(Base)`.
- All API routes are at `backend/routers/` — follow the existing pattern exactly.
- Frontend expects `@/` imports and typed API responses — mirror model changes in `frontend/src/types.ts`.