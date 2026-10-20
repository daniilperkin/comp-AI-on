# Changelog

All notable changes to comp[AI]on are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-10-20

First stable release: a local-first developer log for AI-model consumption
with quality scores, spend tracking and analytics.

### Added
- Log entries with quality (1–10), outcome, category, task, tokens, latency,
  cost and notes; quick-add bar on the dashboard, full form, edit/delete.
- Hermes chat/session titles imported as a first-class field — the History
  table and the rate queue show what each session was about, not just the
  model and a synthetic "auto-imported" marker.
- Analytics: daily timeline (7/30/90/all), model leaderboard, model×category
  quality matrix, spend breakdown per day and per model.
- Spend tracking: per-model $/MTok prices with automatic cost derivation,
  explicit-cost override, 30-day and all-time totals.
- OpenRouter usage sync (API key, deduped imports) and **Hermes usage sync**
  (read-only `state.db` across all local profiles; per session × model × task;
  auto-registers unknown model slugs so spend/leaderboard attribute them).
- **Rate queue** (`/rate`): keyboard-driven scoring of unrated entries.
- Recommender ("best tool for this task", Bayesian-shrunk quality) and
  side-by-side model comparison.
- Daily reminder notifications (OS toast, browser overlay, Telegram/Discord
  webhooks) and an optional daily USD budget warning.
- CSV/JSON exports with filters; monthly per-model summary endpoint.
- **Public demo build** (in-browser fixtures, no backend) deployed to
  GitHub Pages, plus an **opt-in Firebase mirror** (Firestore push, read-only
  phone view with Google sign-in).
- Opt-in "telemetry sweep" motion language (Settings → Appearance), fully
  disabled under `prefers-reduced-motion`.
- Agent tooling: `DESIGN.md` design contract, dev-only Agentation overlay,
  and per-directory agent guides.

### Fixed
- Naive-UTC datetimes rejected by sqlmodel ≥ 0.0.48 (`NaiveDatetime` fields).
- `success_rate` diluted to 0 by outcome-less synced rows — it now divides by
  entries that actually carry an outcome.
- One-click launchers failed when the repo path contains brackets
  (PowerShell `Test-Path` wildcard semantics).
- The sidebar footer (Command palette, theme toggle) scrolled away with long
  pages; it is now pinned to the viewport with the nav scrolling on its own.

### Notes
- Local-only by design: no auth, no telemetry; SQLite is the single source of
  truth. Don't expose the backend port to untrusted networks.
- Synced Hermes rows are cumulative per session, so per-day views can
  overcount multi-day sessions (documented limitation).
- Cost for Hermes rows uses Hermes' stored estimates (provider catalog
  pricing), not a reconciled bill.
