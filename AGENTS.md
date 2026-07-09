# AGENTS.md — comp[AI]on

> This file is the canonical guide for any AI coding agent working on this project.
> Read it fully before making changes. Follow every convention documented here.

## 1. Project Overview

**comp[AI]on** is a minimalist developer log and dashboard built for tracking daily AI model consumption. Instead of just counting tokens, it captures *context and quality* — which models (local, web, or agentic) excel at specific programming or creative tasks — so you always know the best tool for the job.

### Core value proposition
- Log AI model interactions with quality scores (1–10), outcomes, task categories
- See analytics: which models win at which tasks
- Daily reminder system (once-daily check-in, no nagging)
- 100% local — all data in a single SQLite file, no cloud dependencies

## 2. Tech Stack

| Layer | Technology | Version constraints |
|---|---|---|
| Frontend | React 18 (Vite) | Node 20+ required |
| Styling | Tailwind CSS 3 + custom shadcn/ui components | — |
| Charts | Recharts 2 | — |
| Backend | Python FastAPI | Python 3.11+ required |
| ORM | SQLModel (SQLAlchemy + Pydantic) | — |
| Database | SQLite (single file) | — |
| Launcher | Batch file + PowerShell script | Windows-first |

### Package managers
- **Frontend**: npm (do NOT use yarn or pnpm)
- **Backend**: pip (inside a virtualenv at `backend/.venv/`)

## 3. Project Structure

```
comp[AI]on/
├── AGENTS.md                  # THIS FILE — read first
├── CLAUDE.md                  # Claude-specific guidance
├── GEMINI.md                  # Gemini-specific guidance
├── README.md                  # User-facing readme
├── .gitignore
├── start.bat                  # One-click launcher (default)
├── start.ps1                  # PowerShell launcher
│
├── backend/
│   ├── AGENTS.md              # Backend-specific agent guide
│   ├── __init__.py            # Makes `backend` a package
│   ├── requirements.txt       # Python deps
│   ├── main.py                # FastAPI app entry, lifespan, router registration, static mount
│   ├── db.py                  # Engine, session dependency, init_db()
│   ├── models.py              # All SQLModel tables + create/update schemas
│   ├── seed.py                # Default seed data (models, categories, settings)
│   ├── database.db            # SQLite file (gitignored, auto-generated)
│   └── routers/
│       ├── __init__.py
│       ├── logs.py            # Log entry CRUD
│       ├── models.py          # Model CRUD
│       ├── categories.py      # Category CRUD
│       ├── stats.py           # Analytics/stats endpoints
│       └── settings.py       # Settings GET/PUT
│
└── frontend/
    ├── AGENTS.md              # Frontend-specific agent guide
    ├── package.json
    ├── vite.config.ts         # Dev proxy /api -> localhost:8000
    ├── tsconfig.json          # TypeScript config (strict)
    ├── tsconfig.node.json     # Node-specific TS config (composite)
    ├── tailwind.config.js     # Tailwind theme + dark mode
    ├── postcss.config.js
    ├── index.html
    ├── public/
    │   └── favicon.svg
    └── src/
        ├── main.tsx           # React entry + BrowserRouter
        ├── App.tsx            # Router + sidebar layout
        ├── index.css          # Tailwind directives + CSS vars (dark theme)
        ├── types.ts           # TS interfaces mirroring backend models
        ├── vite-env.d.ts
        ├── lib/
        │   ├── api.ts         # Fetch wrapper (get/post/patch/put/delete)
        │   └── utils.ts        # cn(), formatDate(), formatDateShort()
        ├── components/
        │   ├── ui/            # shadcn-style primitives (button, input, card, etc.)
        │   ├── StatCard.tsx
        │   ├── QuickAddBar.tsx # Quick-add form + useModelsCategories hook
        │   ├── LogForm.tsx     # Full log entry form (create/edit)
        │   └── LogTable.tsx    # Reusable table for log entries
        └── pages/
            ├── Dashboard.tsx   # Overview stats + quick add + recent entries
            ├── Log.tsx         # Full log form page (create/edit)
            ├── History.tsx     # Filterable log table
            ├── Models.tsx      # Model CRUD UI
            ├── Settings.tsx    # Settings (reminder time)
            └── Analytics.tsx   # (Phase 2 — analytics charts)
```

## 4. Development Setup

### First-time setup
Run either launcher — it auto-creates the venv, installs all deps, and starts both servers:
```
start.bat
```
or
```
.\start.ps1
```

### Manual setup (if launcher fails)
```powershell
# Backend
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# Frontend
cd frontend
npm install
```

### Running dev servers manually
```powershell
# Terminal 1 — Backend (port 8000)
cd C:\Users\danyo\Desktop\Uni\comp[AI]on
set PYTHONPATH=C:\Users\danyo\Desktop\Uni\comp[AI]on
backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend (port 5173)
cd C:\Users\danyo\Desktop\Uni\comp[AI]on\frontend
npm run dev
```

### URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Vite proxies `/api` to the backend in dev mode (no CORS issues)

## 5. Key Commands

| Command | What it does | Where to run |
|---|---|---|
| `start.bat` | Auto-setup + launch both servers | Repo root |
| `.\start.ps1` | Same, PowerShell version | Repo root |
| `npm run dev` | Start Vite dev server | `frontend/` |
| `npm run build` | TypeScript check + Vite production build | `frontend/` |
| `npm run preview` | Preview production build | `frontend/` |
| `uvicorn backend.main:app --reload --port 8000` | Start backend dev server | Repo root (with PYTHONPATH set) |

### Critical: PYTHONPATH
The backend uses absolute imports like `from backend.models import ...`. You MUST set:
```
PYTHONPATH=C:\Users\danyo\Desktop\Uni\comp[AI]on
```
when running uvicorn directly. The launchers handle this automatically via `cmd /c set PYTHONPATH=...`.

## 6. Code Conventions

### Python (Backend)
- **Python 3.11+** required
- Use **absolute imports**: `from backend.models import LogEntry` (not relative)
- **SQLModel base-class pattern**: Table models extend a `*Base` schema, then inherit `table=True`:
  ```python
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
  ```
  **NEVER** define Create/Update schemas as `class FooCreate(Foo, table=True)` — this causes an SQLAlchemy `AttributeError: 'NoneType' object has no attribute 'set'` at runtime.
- No comments unless explicitly requested
- Use `Field(default=None, ge=1, le=10)` for validated ranges
- Router prefix pattern: `APIRouter(prefix="/api/<resource>", tags=["<resource>"])`
- All endpoints return the SQLModel instance directly (FastAPI serializes it)

### TypeScript / React (Frontend)
- **Strict mode** is on — no `any` types, no unused vars/params
- Use **path alias** `@/` for `src/` imports: `import { Button } from "@/components/ui/button"`
- **Functional components only** with hooks — no class components
- **shadcn/ui components** are hand-written (not via CLI) in `src/components/ui/` — they use `class-variance-authority` + `tailwind-merge` + `clsx`
- Use `cn()` from `@/lib/utils` for conditional class merging
- Pages go in `src/pages/`, reusable components in `src/components/`
- API calls go through `src/lib/api.ts` — never use `fetch()` directly in components
- Types mirroring backend models live in `src/types.ts`
- No comments unless explicitly requested
- Dark mode is the default and only mode — `class="dark"` on `<html>` and `<body>`

### CSS / Styling
- Tailwind utility classes in JSX — no separate CSS files except `index.css`
- CSS variables for theming defined in `src/index.css` under `:root`
- High-contrast dark palette: background `hsl(222 47% 11%)`, primary `hsl(199 89% 48%)`
- Border radius uses `--radius` CSS var (0.5rem)

## 7. Database

### Location
`backend/database.db` — single SQLite file, gitignored.

### Schema (SQLModel tables)
- **models**: id, name, kind (local/web/agentic), vendor, is_active, created_at
- **categories**: id, name, color, created_at
- **log_entries**: id, created_at, model_id (FK), model_name_text, category_id (FK), category_name_text, task_description, quality_score (1-10), outcome (solved/partial/failed), input_tokens, output_tokens, cost_usd, latency_ms, notes
- **settings**: key (PK), value (string)

### Key design decisions
- Log entries have **both** FK fields (`model_id`, `category_id`) AND free-text fallbacks (`model_name_text`, `category_name_text`) — allows quick-add without picking from a list
- All fields on `log_entries` are optional except `id` and `created_at` — validation requires at least one of: model, category, or task_description
- **No migrations** (Alembic) in Phase 1–2 — `SQLModel.metadata.create_all()` on startup. Delete `database.db` to reset.
- Settings are key-value strings (e.g., `reminder_time` = `"18:00"`)

### Resetting the database
Delete `backend/database.db` and restart — it re-creates and re-seeds on next launch.

### Seed data
Defined in `backend/seed.py`:
- 6 default models (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, Cursor, GitHub Copilot, Llama 3.1)
- 7 default categories (Coding, Debugging, Refactoring, Writing, Design, Research, Architecture)
- 3 default settings (reminder_enabled, reminder_time, theme)

## 8. API Structure

All API routes are prefixed with `/api`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET, POST | `/api/logs` | List (with filters) / create log entry |
| GET, PATCH, DELETE | `/api/logs/{id}` | Single log entry CRUD |
| GET, POST | `/api/models` | List / create model |
| PATCH, DELETE | `/api/models/{id}` | Update / delete model |
| GET, POST | `/api/categories` | List / create category |
| PATCH, DELETE | `/api/categories/{id}` | Update / delete category |
| GET | `/api/stats/overview` | Aggregate stats (total, avg quality, success rate, top models) |
| GET, PUT | `/api/settings` | Get / update settings |

### Adding a new endpoint
1. Create or edit a file in `backend/routers/`
2. Define `router = APIRouter(prefix="/api/<name>", tags=["<name>"])`
3. Add route functions with `@router.get(...)` / `@router.post(...)` decorators
4. Register in `backend/main.py`: `app.include_router(yourmodule.router)`

## 9. Frontend Architecture

### Routing
`react-router-dom` v6 with `BrowserRouter` in `src/main.tsx`. Routes defined in `src/App.tsx`.
Future flags enabled: `v7_startTransition`, `v7_relativeSplatPath`.

### Layout
Sidebar nav (Dashboard, New Log, History, Models, Settings, Analytics) + main content area.
Dark theme applied via `class="dark"` on `<html>`.

### API client
`src/lib/api.ts` exports an `api` object with `get`, `post`, `patch`, `put`, `delete` methods.
All methods auto-serialize JSON and throw on non-2xx responses with the error detail.

### Component patterns
- **Pages** are default-exported React components in `src/pages/`
- **UI primitives** in `src/components/ui/` — hand-written shadcn-style (button, input, label, textarea, select, card, badge, table)
- **Feature components** in `src/components/` — StatCard, QuickAddBar (exports `useModelsCategories` hook), LogForm, LogTable

### Adding a new page
1. Create `src/pages/MyPage.tsx` with a default export
2. Add a `<Route path="/my-page" element={<MyPage />} />` in `src/App.tsx`
3. Add a nav entry in the `nav` array in `src/App.tsx`

### Adding a new UI component
1. Create `src/components/ui/mycomponent.tsx`
2. Use `cn()` from `@/lib/utils` for class merging
3. Use `class-variance-authority` for variant props if needed
4. Export as named or forwardRef component

## 10. Phase Roadmap

### Phase 1 (DONE) — MVP logging + dashboard
- Backend CRUD for logs/models/categories
- Dashboard with overview stats + recent entries
- QuickAddBar + full Log form
- History page with filters
- Models CRUD page
- Settings page (reminder time saves to DB)
- Launchers (start.bat + start.ps1)

### Phase 2 (IN PROGRESS) — Analytics
- Analytics endpoints: timeline, leaderboard, model-vs-category matrix
- Separate `/analytics` page with recharts
- Daily entry timeline chart
- Model leaderboard (simple ranking by avg quality)
- Model-vs-category matrix (best model per category)
- CSV + JSON export
- UI polish + animations

### Phase 3 (PLANNED) — Notifications
- APScheduler background job (once-daily at configured time)
- Check if today's entry exists; if not, fire notifications
- Native Windows toast (BurntToast/PowerShell subprocess)
- In-browser overlay (polling `/api/notifications`)
- Test notification button
- Telegram + Discord webhook channels (pluggable)

### Phase 4 (PLANNED) — Interactive recommender
- "Best tool for this task" interactive recommender
- Side-by-side model comparison view
- Script-based tracking automations
- Optional auth

## 11. Common Pitfalls & Gotchas

### Brackets in folder name
The repo path contains `comp[AI]on` — the brackets are wildcard characters in PowerShell. Always use `-LiteralPath` with PowerShell cmdlets:
```powershell
# WRONG — brackets treated as wildcard
Test-Path "C:\Users\danyo\Desktop\Uni\comp[AI]on"
cd "C:\Users\danyo\Desktop\Uni\comp[AI]on"

# CORRECT
Test-Path -LiteralPath "C:\Users\danyo\Desktop\Uni\comp[AI]on"
Set-Location -LiteralPath "C:\Users\danyo\Desktop\Uni\comp[AI]on"
```

When using `Start-Process -WorkingDirectory`, the brackets break it. Use `cmd /c set PYTHONPATH=... && python ...` instead.

### SQLModel table inheritance
**NEVER** do `class FooCreate(Foo, table=True)` where `Foo` already has `table=True`. This causes a silent SQLAlchemy error. Always use the base-class pattern documented in section 6.

### PYTHONPATH for backend
The backend uses absolute imports (`from backend.models import ...`). When running uvicorn directly, you MUST set `PYTHONPATH` to the repo root. The launchers handle this; manual runs do not.

### Vite proxy
In dev mode, Vite proxies `/api/*` to `http://localhost:8000`. The frontend code uses relative paths (`/api/logs`) — never hardcode `localhost:8000` in frontend code.

### No CORS in production
In production, FastAPI serves the built frontend from `frontend/dist/` as static files. CORS is only needed in dev (and is configured in `main.py` for `localhost:5173`).

### Build artifacts
`frontend/vite.config.js` and `frontend/vite.config.d.ts` are TypeScript build artifacts — they're gitignored. Don't commit them.

## 12. Testing

No test framework is set up yet. For now, verify changes by:
1. Run `npm run build` in `frontend/` — TypeScript strict mode catches errors
2. Start backend and test API endpoints with `Invoke-WebRequest` (PowerShell)
3. Use the frontend UI to test end-to-end flows

**IMPORTANT: Do NOT delete `backend/database.db` during testing.** The user is actively using the app with real data. A full DB wipe destroys all log entries, custom models, and categories. To test without affecting real data, either:
- Use a temporary copy: `Copy-Item backend\database.db backend\test.db` and point your test script at it
- Add test entries via the API and delete them individually afterward (DELETE `/api/logs/{id}`)
- Only wipe the DB if the user explicitly asks for a reset

## 13. Git Conventions

- Branch: `main`
- Commit messages: descriptive, may include phase/feature info
- Never commit: `database.db`, `node_modules/`, `.venv/`, `dist/`, build artifacts
- The `.gitignore` handles all of the above — don't modify it unless adding new ignore patterns
