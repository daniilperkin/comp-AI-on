# GEMINI.md — Guidance for Gemini/Antigravity

> **Single source of truth for project conventions: [`AGENTS.md`](./AGENTS.md).**
> Read `AGENTS.md` first for setup, commands, architecture, code conventions, and the complete project guide.
> This file adds Antigravity-specific gotchas and prompting tips.

## Antigravity-specific gotchas

### SQLModel trap (#1 bug source)
NEVER create `class FooCreate(Foo, table=True)` — use the base-class pattern. This crashes at runtime with `AttributeError`.

**Correct pattern:**
```python
class ModelBase(SQLModel):
    name: str

class Model(ModelBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

class ModelCreate(ModelBase):
    pass  # No table=True!
```

### PYTHONPATH must be set
When running uvicorn directly (not via the launcher), `PYTHONPATH` must point to the repo root. Without it, `from backend.models import ...` fails.

### `comp[AI]on` bracket trap
The folder name has `[AI]` brackets. In PowerShell, `Set-Location comp[AI]on` matches `compAon` as a wildcard. Use `-LiteralPath` or Python's `pathlib`:
```powershell
Set-Location -LiteralPath "comp[AI]on"
```

### API client rule
All HTTP calls go through `src/lib/api.ts` in the frontend. Never use `fetch()` directly in components.

### Path alias
Frontend uses `@/` path alias for `src/` imports — never use relative paths like `../../components`.

## Antigravity prompting tips

| Do | Don't |
|---|---|
| "analyze src/pages/Dashboard.tsx in frontend" | "analyze frontend" (too vague) |
| "verify with npm run build in frontend/" | "check if it works" (no command) |
| "search across all .ts and .tsx files in frontend/src/" | "find usages" (picks wrong tool) |

## Pattern reference

Backend endpoints follow: `routers/<resource>.py` → `APIRouter(prefix="/api/<resource>")` → register in `main.py`.
Frontend pages follow: `src/pages/MyPage.tsx` → route in `App.tsx` → nav entry.

## When unsure
- Read `AGENTS.md` for canonical conventions.
- Read `frontend/AGENTS.md` before touching frontend code.
- Read `backend/AGENTS.md` before touching backend code.
