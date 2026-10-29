# Changelog

All notable changes to comp[AI]on are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.1] — 2026-10-20

Everything from the desktop UI/UX audit (17 items), plus the Firebase removal
and dependency cleanup that clears the production advisory set.

### Added
- **History filters**: free-text search over task/session/model/notes, a date
  range, an "unrated only" toggle and a per-page selector — all kept in the
  URL and inherited by the CSV/JSON exports. `GET /api/logs` gained `q`,
  `date_from` and `date_to`; both export endpoints accept them too.
- **Models table**: name, vendor, kind, status, entries, average score and
  actions, with search. 44 models now fit in ~2,550 px instead of ~3,896 px.
- **Compare search**: filter-as-you-type, selected chips pinned to the top,
  `aria-pressed` on every chip and a "Clear selection" action.
- **Measured pricing** (`backend/pricing.py`): per-model token rates that
  override Hermes' stored estimate where a rate is known (deepseek-v4.1-flash
  family: $0.10 in / $0.60 out / $0.003 cache-read per M). All-time spend
  $547.40 → $496.22; the Dashboard labels the figure "measured + estimated".
- **Accessibility**: every form control has an id + label, icon-only buttons
  carry accessible names ("Edit <model>", "Delete <model>"), `CardTitle`
  renders `h2` (no more h1→h3 skips), the analytics matrix scroller is
  keyboard-focusable, and `src/a11y.test.tsx` runs axe-core over the Log form
  and the Models list.
- `ConfirmDialog` (Radix `alertdialog`) and `Switch` primitives.

### Changed
- All app-level number and date formatting is pinned to en-US, so a German
  Windows locale no longer renders "1.468" or "20. Okt." inside the English UI.
- The quick log is a real form: Enter saves, Escape clears, and validation
  errors that only the description can satisfy expand the bar and focus it.
- The full Log form confirms saves with the same toast + Undo as the quick bar.
- Settings uses one switch idiom (motion, channels, reminder) and the Save
  button sits under the budget with a note on what it persists.
- Dashboard stat row is five columns at `xl`; the analytics matrix spans both
  columns; the leaderboard truncates model ids in the middle; the Recommender
  requests eight picks and explains its ranking beside them.
- react-router-dom 6 → 7 (removes the two moderate advisories; the `future`
  flags are the default in v7, so `BrowserRouter` lost them).
- npm `overrides` pin `braces`, `micromatch` and `postcss-selector-parser` to
  their patched releases inside the Tailwind 3 build chain.

### Removed
- **Firebase mirror** (backend module, Firestore transport, rules, config and
  the `firebase-admin` dependency). It was opt-in and never configured; the
  local SQLite database stays the single source of truth. `npm audit
  --omit=dev` is now clean.

### Fixed
- Rate page: the last score button reads "10 (0)", token counts use the shared
  formatter, and the duplicated cost is gone — the Hermes sync no longer writes
  "cost: …" into notes, where it repeated the badge.
- Copy: "no outcomes yet" instead of "no solved", "All categories (global
  ranking)" instead of "(global)".
- Destructive buttons use pure white text — 4.80:1, AA compliant (was 4.44).

## [0.5.0] — 2026-10-20

First public release: a local-first developer log for AI-model consumption
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
  GitHub Pages.
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
