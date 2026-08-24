# comp[AI]on Feature Roadmap — 5 Features, Planned

**Date:** 2026-08-24
**Status:** Plan only — nothing implemented
**Repo:** `1_Uni/Projekte/comp[AI]on` (FastAPI + SQLModel + SQLite backend, React 18 + Vite + Tailwind frontend)

All five features are grounded in the current code (verified today): `LogEntry` already
has `input_tokens` / `output_tokens` / `cost_usd` / `latency_ms` columns,
`stats.py` already accepts `days=`, `notify.py` has working webhook senders, and
migrations run via Alembic (`render_as_batch=True`).

Suggested build order = dependency order:

```
F3 (date-range)      — standalone, 30 min, do first as a warm-up
F2 (cost tracking)   — standalone on existing cost_usd column
F4 (daily budget)    — depends on F2's aggregation helper
F1 (OpenRouter sync) — biggest; benefits from F2's pricing table
F5 (export polish)   — independent, anytime
```

---

## F1 — OpenRouter Usage Sync

**Goal:** Pull real usage data from the OpenRouter API and pre-fill log entries, so the
logger self-populates instead of relying on manual entry.

**Why it's #1:** The tool's core purpose is "know which models win at which tasks."
Manual logging is the friction that kills that. Auto-import makes the data real.

### Architecture

- New backend module `backend/openrouter_sync.py` — pure functions + one orchestrator.
- New router `backend/routers/sync.py` exposing:
  - `POST /api/sync/run` — syncs since last sync (or N days back), returns summary.
  - `GET /api/sync/status` — last sync time, entries created/skipped, configured?
- Settings keys (existing `Setting` table, no schema change):
  - `openrouter_api_key` (user enters in Settings UI; stored like other settings)
  - `openrouter_sync_enabled` (bool-ish string)
  - `last_sync_at` (ISO timestamp, written after each successful run)
- Dedup strategy: OpenRouter's usage/activity endpoint returns generation IDs.
  Store the external ID per imported entry so re-syncs skip what's already logged.
  Two options:
  - **A (chosen):** add nullable `external_id: str | None` column to `log_entries`
    + unique index. One migration (0003), clean forever.
  - B: hash-match on (model name + timestamp rounded to minute). No migration but
    fragile if two calls land in the same minute. Only pick this if you refuse migrations.

### OpenRouter API

Endpoint: `GET https://openrouter.ai/api/v1/activity` (Bearer key) — paginated list of
generations with model, tokens (prompt/completion), cost, timestamp.
(Verify exact response shape with one live call before coding against it — see Risks.)

### Mapping rules

| OpenRouter field | LogEntry field |
|---|---|
| `model` slug e.g. `openai/gpt-4o-mini` | match/create `Model` row by name; `model_name_text` fallback |
| `token_usage.prompt` | `input_tokens` |
| `token_usage.completion` | `output_tokens` |
| `cost` (USD float) | `cost_usd` |
| `created` timestamp | `created_at` |
| — | `category_id`: null (user assigns later); or auto-map via keyword rule later |
| — | `task_description`: `"auto-imported"` marker so manual vs synced is filterable |
| — | `quality_score`, `outcome`: left empty for user review |

### Tasks (TDD order)

1. **Migration 0003**: add `external_id` column + unique index on `log_entries`.
2. **Client function** `fetch_activity(api_key, days_back)` → typed dicts; requests +
   timeout + retry via the same pattern used elsewhere. Test: mock HTTP.
3. **Dedup helper** `filter_new(generations, session)` → set-diff against existing
   `external_id`s. Pure, unit-testable.
4. **Mapper** `generation_to_logentry(gen)` → `LogEntryCreate`. Pure, table-driven tests.
5. **Orchestrator** `run_sync(session)` → creates rows, updates `last_sync_at`,
   returns `{created, skipped, errors}`. Test with seeded fake generations.
6. **Router** wiring both endpoints. Integration test via test client (conftest exists).
7. **Frontend**: `lib/api.ts` has POST/GET already; add `useSyncStatus()` +
   `useRunSync()` hooks in `queries.ts`; "Sync now" button + status line in
   `Settings.tsx`; optional badge on Dashboard when entries were imported.
8. Optional scheduler hook: daily auto-sync at reminder time (reuse APScheduler setup).

**Files:** new `backend/openrouter_sync.py`, `backend/routers/sync.py`,
`backend/migrations/versions/0003_logentry_external_id.py`; modify
`backend/main.py` (router registration), `frontend/src/lib/queries.ts`,
`frontend/src/pages/Settings.tsx`.

**Tests:** ~10 new backend tests (mapper table-driven, dedup, orchestrator, endpoints).
FE gates: eslint/vue-tsc-equivalent (tsc -b), vitest, vite build.

**Risks / open questions:**
- Exact activity-endpoint shape unverified → do a 10-minute spike: one authenticated
  curl, print JSON, adjust mapper before writing task 2.
- Pagination on long history: loop pages until `last_sync_at` cutoff.
- Local models (LM Studio) never appear here — sync complements, not replaces, manual logs.

---

## F2 — Cost Tracking & Monthly Report

**Goal:** Show spend per entry/day/month/model; monthly total card on Dashboard;
cost column in leaderboard.

**Leverage:** `cost_usd` column already exists on every log entry. This feature is
~90% read-side aggregation + one pricing helper for entries lacking cost.

### Design

1. **Pricing table** (optional but recommended): add to `models` table via
   migration 0004: `input_price_per_mtok: float | None`, `output_price_per_mtok: float | None`.
   User fills once per model (Settings → Models gets two new inputs).
2. **Cost derivation** `derive_cost(entry, model)` in `backend/costing.py`:
   - If `entry.cost_usd` set → use it.
   - Else if prices known → `in/1e6*pin + out/1e6*pout`.
   - Else None. Pure function, heavy unit tests (rounding, zero-token edge cases).
3. **Stats extension** (`routers/stats.py`):
   - `/overview` gains `total_cost_30d`, `total_cost_all_time`.
   - `/leaderboard` rows gain `total_cost`.
   - New `/spend?days=` endpoint: per-day cost series + per-model breakdown
     (single grouped query each — no N+1; follow `_load_models` pattern).
4. **Frontend**:
   - Dashboard: one StatCard "Spend (30d)".
   - Analytics: second axis/area on timeline OR dedicated small bar chart of
     per-model spend this month.
   - Models page: two price inputs.
   - Format: `$0.0042` style — don't round to cents, costs are millidollars.

**Tests:** derive_cost table-driven (~6 cases); spend endpoint integration test
(seeded entries incl. one with cost_usd=None + priced model → derived).

**Files:** migration 0004, new `backend/costing.py`, modify `models.py`,
`routers/stats.py`, `routers/models.py` (accept price fields),
FE: queries.ts, DashboardPage, Analytics, Models page.

---

## F3 — Date-Range Control on Analytics Timeline

**Goal:** Let the user pick 7/30/90/all on the Analytics timeline chart.
Cheapest item; backend `days=` param already works (`routers/stats.py:77`).

### Design

- `useStatsTimeline(days?: number)` in `queries.ts`: append `?days=` when set,
  `placeholderData: keepPreviousData` for smooth switching (pattern already used by
  useLogsPaged).
- `Analytics.tsx`: small segmented control above the chart (7 / 30 / 90 / All),
  state local to page, default 30.
- Leaderboard/matrix keep their own (unchanged) windows — scope creep guard.

**Files:** `queries.ts` (one hook signature), `Analytics.tsx` (+15 lines UI).

**Test:** vitest render test asserting the fetch URL contains `days=7` after clicking 7d
(follow existing query-hook test style); otherwise covered by tsc + manual click-through.

---

## F4 — Daily Budget & Warning Toast

**Goal:** Configurable daily spend/count budget; toast + optional webhook when crossed.

Depends on F2's `derive_cost` + `/spend` aggregation (or computes inline if built first).

### Design

1. Settings keys: `daily_budget_usd` (string float, empty = off),
   `daily_budget_warned_on` (date string — one warning per day, not per request).
2. Check placement: inside `create_log` router path AND after each sync batch (F1) —
   both are the moments spend can jump.
3. Trigger logic `check_budget(session)` in `backend/budget.py`:
   sum today's (UTC day, matching stats' naive-UTC convention) derived costs →
   compare → if first crossing today: fire NotificationOverlay toast via existing
   notifications machinery + reuse `send_discord_webhook` / `send_telegram_webhook`
   (already implemented and tested in `notify.py`) with title "Budget exceeded".
   Write `daily_budget_warned_on` so it fires once/day.
4. Frontend: budget input in Settings; red "over budget" hint next to the Spend card.

**Tests:** budget check unit tests (under/at/over, once-per-day semantics across
midnight boundary); endpoint test creating an entry over budget asserts notification
row created.

**Files:** new `backend/budget.py`, modify `routers/logs.py` (post-create hook),
`notify.py` callers, Settings UI, Dashboard hint.

---

## F5 — Export Polish (CSV/JSON improvements)

**Goal:** Make exports actually useful outside the app: date-range + filters honored,
cost column included (F2), and a monthly-summary export.

Current state (from audit): `/logs/export` exists via `routers/logs.py` but ignores
the same filters History uses; no cost rollup.

### Design

1. Accept same query params as list endpoint (`model_id`, `category_id`, `date_from`,
   `date_to`) in CSV + JSON export; document in api docs string.
2. Add `derived_cost` column to CSV (uses F2 helper; blank when unknown).
3. New `GET /api/stats/monthly?month=YYYY-MM`: one row per model — count, tokens in/out,
   total cost, avg quality. Frontend button "Download month summary (CSV)" on
   Dashboard/History.
4. Keep streaming-free (dataset sizes are personal-scale; simple response is fine).

**Tests:** export-with-filters integration test; monthly aggregation test with seeded
two-month data.

**Files:** `routers/logs.py`, `routers/stats.py`, FE buttons in History/Dashboard.

---

## Cross-cutting conventions (apply to all)

- **Gates before commit:** `pytest backend/tests` green; frontend `npm run build`
  (runs tsc -b) + `npx vitest run` + eslint 0 errors.
- **Migrations:** Alembic, numbered 0003+, `render_as_batch=True` already set; verify
  fresh-DB path (`stamp("0001")` baseline behavior) still upgrades cleanly after
  adding migrations — this was flagged as a risk area in earlier audits.
- **No N+1:** follow `_load_models()` bulk-load pattern in any new stats join.
- **Docs:** update root AGENTS.md §Project Structure + Phase list, and README feature
  bullets as part of each feature's final commit — the drift you just paid down
  shouldn't regrow.
- **Commit style:** plain English imperative, detailed rationale (house rule).

## Effort summary

| # | Feature | Est. | Depends on |
|---|---|---|---|
| F1 | OpenRouter sync | ½–1 day (incl. spike) | — (wants F2 pricing) |
| F2 | Cost tracking | 3–4 h | — |
| F3 | Timeline date-range | 30 min | — |
| F4 | Daily budget | 2–3 h | F2 |
| F5 | Export polish | 2–3 h | F2 (for cost col) |

Total: roughly 2 focused days for everything.
