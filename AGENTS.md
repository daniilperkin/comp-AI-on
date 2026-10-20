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
├── .env.example               # COMPANION_* env var template
├── alembic.ini                # Alembic config (script_location = backend/migrations)
├── pytest.ini
├── .github/workflows/ci.yml   # CI gate
├── .github/workflows/pages.yml # GitHub Pages demo deploy (VITE_DATA_SOURCE=demo)
├── start.bat                  # One-click launcher (default)
├── start.ps1                  # PowerShell launcher
│
├── backend/
│   ├── AGENTS.md              # Backend-specific agent guide
│   ├── __init__.py            # Makes `backend` a package
│   ├── requirements.txt       # Python deps
│   ├── ruff.toml              # Ruff linter config
│   ├── main.py                # FastAPI app entry, lifespan, router registration, static mount
│   ├── db.py                  # Engine, session dependency, init_db()
│   ├── config.py              # Configuration and settings
│   ├── costing.py             # Cost derivation (explicit > token-derived > unknown)
│   ├── budget.py              # Daily budget check (once-per-day warning)
│   ├── openrouter_sync.py     # OpenRouter usage sync (fetch, dedupe, map)
│   ├── hermes_sync.py         # Hermes usage sync (state.db read-only, upsert)
│   ├── firebase_mirror.py     # One-way Firestore mirror (phone view + backup)
│   ├── models.py              # All SQLModel tables + create/update schemas
│   ├── seed.py                # Default seed data (models, categories, settings)
│   ├── notify.py              # Notification handlers (toast, browser, webhooks)
│   ├── scheduler.py           # APScheduler background job config
│   ├── database.db            # SQLite file (gitignored, auto-generated)
│   ├── migrations/            # Alembic migrations
│   │   ├── env.py             # Alembic environment (render_as_batch=True)
│   │   └── versions/
│   │       ├── 0001_baseline.py
│   │       ├── 0002_unique_names.py
│   │       ├── 0004_model_pricing.py
│   │       ├── 0005_logentry_external_id.py
│   │       └── 0006_logentry_hermes_fields.py
│   ├── tests/                 # pytest test suite (123 tests)
│   │   ├── conftest.py         # Fixtures (in-memory SQLite, test client)
│   │   ├── test_budget.py
│   │   ├── test_categories.py
│   │   ├── test_costing.py
│   │   ├── test_export_monthly.py
│   │   ├── test_firebase_mirror.py
│   │   ├── test_hermes_sync.py
│   │   ├── test_logs.py
│   │   ├── test_models.py
│   │   ├── test_openrouter_sync.py
│   │   ├── test_recommender.py
│   │   ├── test_scheduler.py
│   │   ├── test_settings.py
│   │   └── test_stats.py
│   └── routers/
│       ├── __init__.py
│       ├── logs.py            # Log entry CRUD + CSV/JSON export
│       ├── models.py          # Model CRUD
│       ├── categories.py      # Category CRUD
│       ├── stats.py           # Analytics/stats (overview, timeline, leaderboard, spend, monthly, matrix)
│       ├── settings.py        # Settings GET/PUT
│       ├── sync.py            # OpenRouter + Hermes usage sync endpoints (status, run)
│       ├── notifications.py   # Notification endpoints (list, test, mark-shown, reschedule)
│       ├── recommend.py       # Interactive recommender endpoint
│       └── compare.py         # Side-by-side model comparison
│
└── frontend/
    ├── AGENTS.md              # Frontend-specific agent guide
    ├── package.json
    ├── vite.config.ts         # Dev proxy /api -> localhost:8765
    ├── tsconfig.json          # TypeScript config (strict)
    ├── tsconfig.node.json     # Node-specific TS config (composite)
    ├── eslint.config.js       # ESLint flat config
    ├── vitest.config.ts       # Vitest config (jsdom)
    ├── tailwind.config.js     # Tailwind theme + dark mode
    ├── postcss.config.js
    ├── index.html
    ├── public/
    │   └── favicon.svg
    └── src/
        ├── main.tsx           # React entry + BrowserRouter
        ├── App.tsx            # Router + sidebar layout
        ├── index.css          # Tailwind directives + CSS vars (light + dark themes)
        ├── types.ts           # TS interfaces mirroring backend models
        ├── vite-env.d.ts
        ├── test-setup.ts      # Vitest setup (jsdom, matchers)
        ├── lib/
        │   ├── api.ts         # Fetch wrapper (get/post/patch/put/delete)
        │   ├── queries.ts     # Shared React Query hooks (incl. useModelsCategories)
        │   ├── navigation.ts  # APP_NAV sidebar entries
        │   ├── demo/          # In-browser fixtures + mock transport (Pages demo build)
        │   ├── mirror/        # Firestore read-only transport (phone-view build)
        │   ├── theme.tsx      # ThemeProvider — system-theme detection + localStorage persistence
        │   ├── utils.ts       # cn(), formatDate(), formatDateShort(), formatCost()
        │   └── *.test.ts(x)   # api, theme, utils tests
        ├── components/
        │   ├── ui/            # shadcn-style primitives (badge, button, card, command, dialog, input, label, select, skeleton, table, textarea)
        │   ├── ErrorBoundary.tsx
        │   ├── ActivityHeatmap.tsx
        │   ├── AnimatedNumber.tsx
        │   ├── CommandPalette.tsx  # cmdk command palette (+ .test.tsx)
        │   ├── QueryError.tsx
        │   ├── QuickCapture.tsx
        │   ├── NotificationOverlay.tsx  # In-browser notification polling + display
        │   ├── StatCard.tsx
        │   ├── QuickAddBar.tsx # Quick-add form (+ .test.tsx)
        │   ├── LogForm.tsx     # Full log entry form (create/edit)
        │   └── LogTable.tsx    # Reusable table for log entries
        └── pages/
            ├── Dashboard.tsx   # Overview stats + quick add + recent entries
            ├── Log.tsx         # Full log form page (create/edit)
            ├── History.tsx     # Filterable log table
            ├── Rate.tsx        # Keyboard-driven rating queue for unrated entries
            ├── Models.tsx      # Model CRUD UI
            ├── Settings.tsx    # Settings (reminder, channels, budget, OpenRouter sync)
            ├── Analytics.tsx   # Analytics charts (timeline, leaderboard, matrix)
            ├── Recommender.tsx # "Best tool for this task" interactive recommender
            ├── Compare.tsx     # Side-by-side model comparison view
            └── NotFound.tsx    # 404 fallback page
```

## 4. Development Setup

### First-time setup
Run either launcher — it auto-creates the venv, installs all deps, starts both servers **without console windows**, and opens the browser:
```
start.bat
```
or `start.vbs` (completely silent — no console flash). Stop with `stop.bat` / `.\stop.ps1`. Server output lands in `logs/` (`backend.log`, `frontend.log`, `launcher.log`, `setup.log`; gitignored).

For development with hot reload in a single console (Ctrl+C stops both):
```
.\start.ps1 -Windowed
```
Launcher internals: `scripts/run-backend.bat` / `scripts/run-frontend.bat` are the per-server wrappers; hidden launches go through `WScript.Shell.Run` because `Start-Process` wildcard-resolves paths under this repo's bracket directory.

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
# Terminal 1 — Backend (port 8765)
cd <repo-root>
set PYTHONPATH=<repo-root>
backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8765

# Terminal 2 — Frontend (port 6769)
cd <repo-root>\frontend
npm run dev
```

### URLs
- Frontend: http://localhost:6769
- Backend API: http://localhost:8765/api
- Vite proxies `/api` to the backend in dev mode (no CORS issues)

## 5. Key Commands

| Command | What it does | Where to run |
|---|---|---|
| `start.bat` | Auto-setup + launch both servers hidden (no windows) + open browser | Repo root |
| `start.vbs` | Same, completely silent (no console flash) | Repo root |
| `stop.bat` | Stop both servers (frees ports 8765/6769) | Repo root |
| `.\start.ps1 -Windowed` | Both servers in one console (hot reload, Ctrl+C stops) | Repo root |
| `npm run dev` | Start Vite dev server | `frontend/` |
| `npm run build` | TypeScript check + Vite production build | `frontend/` |
| `npm run preview` | Preview production build | `frontend/` |
| `npm run lint` | ESLint | `frontend/` |
| `npm run test` | Vitest (single run) | `frontend/` |
| `uvicorn backend.main:app --reload --port 8765` | Start backend dev server | Repo root (with PYTHONPATH set) |

### Critical: PYTHONPATH
The backend uses absolute imports like `from backend.models import ...`. You MUST set:
```
PYTHONPATH=<repo-root>
```
when running uvicorn directly. The launchers don't set it; they `cd` to the repo root and run `python -m uvicorn`, which puts the cwd on `sys.path`.

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
      created_at: datetime = Field(default_factory=_utcnow)  # naive UTC, see models.py _utcnow()

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
- Initial theme is the stored `localStorage` value (`companion-theme`), else the system `prefers-color-scheme`; toggle via the sidebar (persisted to `localStorage` only — no DB `theme` setting is seeded; the API still accepts an optional `theme` key but the frontend never reads it). `class="dark"` on `<html>` controls the active palette — see `src/lib/theme.tsx`'s `useTheme`.

### CSS / Styling
- Tailwind utility classes in JSX — no separate CSS files except `index.css`
- CSS variables for theming defined in `src/index.css` under `:root` (light) and `.dark`
- High-contrast dark palette: background `hsl(0 0% 7%)`, primary `hsl(40 33% 96%)` (warm-gray neutral — see `src/index.css`)
- Border radius uses `--radius` CSS var (0.625rem)

## 7. Database

### Location
`backend/database.db` — single SQLite file, gitignored.

### Schema (SQLModel tables)
- **models**: id, name (unique), kind (local/web/agentic), vendor, is_active, input_price_per_mtok, output_price_per_mtok, created_at
- **categories**: id, name (unique), color, created_at
- **log_entries**: id, created_at, model_id (FK), model_name_text, category_id (FK), category_name_text, task_description, session_title, quality_score (1-10), outcome (solved/partial/failed), input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, cost_usd, latency_ms, notes, external_id (sync dedupe), origin (manual/openrouter/hermes)
- **settings**: key (PK), value (string)
- **notifications**: id, created_at, title, body, channel (only `browser` rows are stored), shown
- **alembic_version**: Alembic's bookkeeping table (single row with the current revision)

### Key design decisions
- Log entries have **both** FK fields (`model_id`, `category_id`) AND free-text fallbacks (`model_name_text`, `category_name_text`) — allows quick-add without picking from a list
- All fields on `log_entries` are optional except `id` and `created_at` — validation requires at least one of: model, category, or task_description
- The Hermes sync reads every Hermes profile's `state.db` read-only (root: `%LOCALAPPDATA%/hermes`, override `COMPANION_HERMES_HOME`) and imports one entry per session × model × task, upserted by `external_id` (`hermes:<profile>:<session>:<pk-hash>`) — live sessions' usage rows keep accumulating, so re-syncs update existing rows instead of skipping them. Runs on startup + every 30 min (APScheduler job `hermes_sync`) and via `POST /api/sync/hermes/run`. Cost is Hermes' stored `estimated_cost_usd` (OpenRouter headline pricing — overstates post-2026-10-07 pinned deepseek-v4.1-flash rows ~2.2x; opus/glm stored estimates verified accurate; deliberate choice, recalibrate via measured rates if it matters). Daily views overcount multi-day sessions (rows are cumulative) — accepted limitation. Slugs without a matching Model row are auto-registered on sync (`kind=web`, vendor = billing provider), so spend, leaderboard and the History model filter attribute fleet usage instead of lumping it into "Unknown"; existing rows are backfilled on the next sync. `success_rate` (overview + leaderboard) divides by entries that actually carry an outcome — Hermes rows have none, and counting them would dilute the rate to 0.
- **Migrations (Alembic)** manage the schema. On startup `init_db()` runs `alembic upgrade head`. Pre-existing pre-Alembic databases are auto-adopted: stamped to the baseline revision then upgraded. Fresh databases run all migrations from empty.
- `PRAGMA journal_mode=WAL`, `PRAGMA foreign_keys=ON`, `PRAGMA synchronous=NORMAL` are applied per connection (see `backend/db.py`'s SQLAlchemy `connect` event listener) — WAL sidecars (`database.db-wal`, `database.db-shm`) are gitignored.
- Settings are key-value strings (e.g., `reminder_time` = `"18:00"`, `seed_version` = `"3"`). Settings updates are validated against a typed `SettingsUpdate` schema (`extra="forbid"` allowlist) in `routers/settings.py`.

### Resetting the database
Delete `backend/database.db` (and the `-wal`/`-shm` sidecars if present) and restart — Alembic recreates all tables and the seed upsert repopulates defaults.

### Adding a schema change (Alembic)
```powershell
# From repo root, with PYTHONPATH set (env.py imports backend.*)
set PYTHONPATH=<repo-root>
backend\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "short description"
# Review the generated file in backend/migrations/versions/, then:
backend\.venv\Scripts\python.exe -m alembic upgrade head
```
The migration is applied automatically on next app startup via `init_db()`. **Always review autogenerated migrations** — SQLite limitations mean some diffs need manual adjustment; `render_as_batch=True` is enabled in `env.py` for batch ALTER support.

### Seed data
Defined in `backend/seed.py` using **upsert-by-name** (adds missing defaults, never overwrites or deletes user data):
- 6 default models (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, Cursor, GitHub Copilot, Llama 3.1)
- 7 default categories (Coding, Debugging, Refactoring, Writing, Design, Research, Architecture)
- 5 default settings (reminder_enabled, reminder_time, channel_os_toast, channel_browser_overlay, hermes_sync_enabled)
- A `seed_version` setting tracks the seed schema version for future migrations.

## 8. API Structure

All API routes are prefixed with `/api`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET, POST | `/api/logs` | List (with filters) / create log entry |
| GET, PATCH, DELETE | `/api/logs/{id}` | Single log entry CRUD |
| GET | `/api/logs/export/csv` | Download all log entries as CSV |
| GET | `/api/logs/export/json` | Download all log entries as JSON |
| GET, POST | `/api/models` | List / create model |
| PATCH, DELETE | `/api/models/{id}` | Update / delete model |
| GET, POST | `/api/categories` | List / create category |
| PATCH, DELETE | `/api/categories/{id}` | Update / delete category |
| GET | `/api/stats/overview` | Aggregate stats (total, avg quality, success rate, top models) |
| GET | `/api/stats/timeline` | Daily entry timeline (for charts) |
| GET | `/api/stats/leaderboard` | Model ranking by average quality score |
| GET | `/api/stats/matrix` | Model-vs-category quality matrix |
| GET | `/api/stats/spend` | Spend summary (30-day / all-time) |
| GET | `/api/stats/monthly` | Monthly per-model summary |
| GET | `/api/sync/status` | OpenRouter sync status |
| POST | `/api/sync/run` | Run OpenRouter usage sync |
| GET | `/api/sync/hermes/status` | Hermes sync status (profiles found, last sync) |
| POST | `/api/sync/hermes/run` | Run Hermes usage sync (all profiles) |
| GET | `/api/sync/firebase/status` | Firebase mirror status (configured, enabled, last push) |
| POST | `/api/sync/firebase/run` | Push the mirror to Firestore now |
| GET, PUT | `/api/settings` | Get / update settings |
| GET | `/api/notifications` | List pending notifications |
| POST | `/api/notifications/test` | Fire a test notification |
| POST | `/api/notifications/mark-all-shown` | Mark all notifications as shown |
| PATCH | `/api/notifications/{id}/shown` | Mark a single notification as shown |
| POST | `/api/notifications/reschedule` | Reschedule the daily reminder job |
| GET | `/api/recommend` | Recommend best model for a given task/category |
| GET | `/api/compare` | Side-by-side comparison of two or more models |

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
Sidebar nav (`APP_NAV` in `src/lib/navigation.ts`: Dashboard, New Log, History, Rate, Analytics, Recommender, Compare, Models, Settings) + main content area.
Theme applied via `class="dark"` on `<html>` (see `src/lib/theme.tsx`).

### API client
`src/lib/api.ts` exports an `api` object with `get`, `post`, `patch`, `put`, `delete` methods.
All methods auto-serialize JSON and throw on non-2xx responses with the error detail.

### Component patterns
- **Pages** are default-exported React components in `src/pages/`
- **UI primitives** in `src/components/ui/` — hand-written shadcn-style (badge, button, card, command, dialog, input, label, select, skeleton, table, textarea)
- **Feature components** in `src/components/` — StatCard, QuickAddBar, QuickCapture, CommandPalette, LogForm, LogTable, ActivityHeatmap, etc. (shared data hooks like `useModelsCategories` live in `src/lib/queries.ts`)

### Adding a new page
1. Create `src/pages/MyPage.tsx` with a default export
2. Add a `<Route path="/my-page" element={<MyPage />} />` in `src/App.tsx`
3. Add a nav entry in `APP_NAV` in `src/lib/navigation.ts`

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

### Phase 2 (DONE) — Analytics
- Analytics endpoints: timeline, leaderboard, model-vs-category matrix
- Separate `/analytics` page with recharts
- Daily entry timeline chart
- Model leaderboard (simple ranking by avg quality)
- Model-vs-category matrix (best model per category)
- CSV + JSON export
- UI polish + animations

### Phase 3 (DONE) — Notifications
- APScheduler background job (once-daily at configured time)
- Check if today's entry exists; if not, fire notifications
- Native Windows toast (BurntToast/PowerShell subprocess)
- In-browser overlay (polling `/api/notifications`)
- Test notification button
- Telegram + Discord webhook channels (pluggable)

### Phase 4 (DONE) — Interactive recommender
- "Best tool for this task" interactive recommender (`Recommender.tsx` + `routers/recommend.py`)
- Side-by-side model comparison view (`Compare.tsx` + `routers/compare.py`)

## 11. Common Pitfalls & Gotchas

### Brackets in folder name
The repo path contains `comp[AI]on` — the brackets are wildcard characters in PowerShell. Always use `-LiteralPath` with PowerShell cmdlets:
```powershell
# WRONG — brackets treated as wildcard
Test-Path "C:\path\to\comp[AI]on"
cd "C:\path\to\comp[AI]on"

# CORRECT
Test-Path -LiteralPath "C:\path\to\comp[AI]on"
Set-Location -LiteralPath "C:\path\to\comp[AI]on"
```

When using `Start-Process -WorkingDirectory`, the brackets break it. Use `cmd /c set PYTHONPATH=... && python ...` instead.

PowerShell 5.1 also returns **false from `Test-Path` for relative paths** when the current directory contains brackets — scripts must check `$Root`-qualified absolute paths (see `start.ps1`). If the venv is ever recreated, use the Python 3.12 install (`python -m venv --clear backend\.venv`).

### SQLModel table inheritance
**NEVER** do `class FooCreate(Foo, table=True)` where `Foo` already has `table=True`. This causes a silent SQLAlchemy error. Always use the base-class pattern documented in section 6.

### Naive datetimes (sqlmodel 0.0.48+)
`datetime` annotations map to `UTCDateTime`, which **rejects naive values** at flush time — seeding/inserts crash with "Datetime values must have timezone information". The app stores naive UTC by design, so timestamp fields use pydantic's `NaiveDatetime`; keep the `sqlmodel>=0.0.48` floor in `requirements.txt`.

### PYTHONPATH for backend
The backend uses absolute imports (`from backend.models import ...`). When running uvicorn directly, you MUST set `PYTHONPATH` to the repo root. Running `python -m uvicorn` from the repo root also works (as the launchers do).

### Vite proxy
In dev mode, Vite proxies `/api/*` to `http://localhost:8765`. The frontend code uses relative paths (`/api/logs`) — never hardcode `localhost:8765` in frontend code.

### No CORS in production
In production, FastAPI serves the built frontend from `frontend/dist/` as static files. CORS is only needed in dev (and is configured in `main.py` for `localhost:6769`).

### Build artifacts
`frontend/vite.config.js` and `frontend/vite.config.d.ts` are TypeScript build artifacts — they're gitignored. Don't commit them.

## 12. Testing

The project has a test suite on both sides, enforced as a CI gate (`.github/workflows/ci.yml` runs lint + tests + build on every push/PR to `main`).

### Backend (pytest) — 123 tests
- Location: `backend/tests/` (uses an in-memory SQLite fixture + FastAPI `TestClient`)
- Run: `python -m pytest backend/tests -v --tb=short` (from repo root, with `PYTHONPATH` set)
- Covers: logs CRUD, stats aggregation (incl. spend + monthly), cost derivation, daily budget, OpenRouter sync (mocked HTTP), export filters, settings, scheduler, recommender, categories, models

### Frontend (vitest) — 29 tests
- Location: `frontend/src/**/*.test.{ts,tsx}` (jsdom environment, setup in `src/test-setup.ts`)
- Run: `npm run test` in `frontend/`
- Covers: `lib/api.ts`, `lib/utils.ts`, `lib/theme.tsx`, `CommandPalette`, `QuickAddBar`

### CI gate
`.github/workflows/ci.yml` runs two jobs:
1. **frontend-build** — ESLint → vitest → `npm run build` (TypeScript strict)
2. **backend-check** — Ruff lint → `compileall` → pytest

### Manual verification (in addition to tests)
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
