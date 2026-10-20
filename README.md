# comp[AI]on

A minimalist developer log and dashboard for tracking daily AI model consumption. Captures which models (local, web, or agentic) excel at specific programming or creative tasks so you always know the best tool for the job.

**Live demo**: https://daniilperkin.github.io/comp-AI-on/ — the real UI running on in-browser sample data, no backend needed.

## Features

- **Quality-focused logging** — score every AI interaction 1–10 with outcome, category, tokens, latency
- **Analytics dashboard** — daily timeline (7/30/90-day range control), model leaderboard, quality×category matrix
- **Spend tracking** — set per-model token prices ($/MTok); costs derive automatically from logged tokens, or enter explicit costs. Dashboard shows 30-day and all-time spend
- **OpenRouter usage sync** — pull real API activity into the log automatically; imported entries are marked "auto-imported" and deduped across re-syncs (Settings → OpenRouter usage sync)
- **Hermes usage sync** — import every local Hermes profile's real token/cost usage from its `state.db` (read-only); unknown model slugs are auto-registered so spend and the leaderboard attribute them
- **Rate queue** — keyboard-driven scoring for auto-imported entries (1–9, 0 = 10, S to skip)
- **Optional Firebase mirror** — push a read-only copy to Firestore for a phone view + backup; strictly opt-in (`firebase/README.md`)
- **Daily budget** — optional USD budget; one warning per day through your enabled notification channels when today's spend crosses it
- **Exports** — CSV/JSON with date-range + model/category filters and derived cost; monthly per-model summary via `/api/stats/monthly`
- **Recommender & compare views** — "best tool for this task" and side-by-side comparison

## Stack

- **Frontend**: React (Vite) + Tailwind CSS + hand-written shadcn-style components
- **Backend**: Python (FastAPI) + SQLModel + SQLite
- **Database**: single local file at `backend/database.db`

## First-time setup

Requires Python 3.11+ and Node 20+ on PATH.

Run either launcher — it auto-creates the Python virtualenv, installs backend deps, runs `npm install` for the frontend, then starts both servers:

```
start.bat
```

or

```
.\start.ps1
```

- Backend: http://localhost:8765 (API at `/api`)
- Frontend: http://localhost:6769 (proxies `/api` to the backend)

## Resetting the database

Delete `backend/database.db` (plus `-wal`/`-shm` sidecars) and restart — it re-creates and re-seeds on next launch.

## Project layout

```
comp[AI]on/
├── start.bat / start.ps1     # one-click launcher
├── frontend/                 # Vite + React + Tailwind + shadcn-style UI
└── backend/                  # FastAPI + SQLModel + SQLite
```
