# comp[AI]on

A minimalist developer log and dashboard for tracking daily AI model consumption. Captures which models (local, web, or agentic) excel at specific programming or creative tasks so you always know the best tool for the job.

## Stack

- **Frontend**: React (Vite) + Tailwind CSS + shadcn/ui
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

Delete `backend/database.db` and restart — it re-creates and re-seeds on next launch.

## Project layout

```
comp[AI]on/
├── start.bat / start.ps1     # one-click launcher
├── frontend/                 # Vite + React + Tailwind + shadcn/ui
└── backend/                  # FastAPI + SQLModel + SQLite
```
