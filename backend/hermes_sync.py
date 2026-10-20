"""Hermes usage sync — pull Hermes Agent session/model usage into log entries.

Design:
- hermes_home() resolves the Hermes data root (``COMPANION_HERMES_HOME`` env
  override; ``%LOCALAPPDATA%/hermes`` on Windows; ``~/.hermes`` elsewhere).
- discover_profile_dbs() finds the default profile's state.db plus every
  ``profiles/<name>/state.db`` below it. Profiles come and go, so discovery
  runs on every sync.
- read_profile_usage() opens each state.db read-only (WAL allows concurrent
  readers while gateways write) and returns per-(session, model, provider,
  task) usage rows joined with session metadata. Missing tables/columns are
  tolerated — the Hermes schema evolves across versions.
- run_sync() upserts by external_id: unlike OpenRouter's append-only activity,
  a live session's usage row keeps accumulating deltas, so re-syncs must
  update token/cost fields of already-imported rows instead of skipping them.

Mapping notes:
- Hermes' input_tokens is uncached input only; total input is
  input + cache_read + cache_write, each stored in its own column here.
- Cost prefers a measured per-model rate (backend/pricing.py) when one exists
  for the model, then actual_cost_usd when the provider reported real billing,
  else estimated_cost_usd (Hermes prices via its provider-models catalog).
- quality_score/outcome/latency_ms stay NULL — Hermes records none of them.
"""
import hashlib
import logging
import os
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from backend.models import LogEntry, Model, ModelKind
from backend.openrouter_sync import _load_model_map, _match_model
from backend.pricing import measured_cost

logger = logging.getLogger(__name__)

SYNC_ENABLED_KEY = "hermes_sync_enabled"
LAST_SYNC_KEY = "last_hermes_sync_at"
EXTERNAL_ID_PREFIX = "hermes:"
NOTES_MAX = 4000

USAGE_COLUMNS = (
    "session_id", "model", "billing_provider", "billing_base_url", "billing_mode",
    "task", "api_call_count", "input_tokens", "output_tokens", "cache_read_tokens",
    "cache_write_tokens", "reasoning_tokens", "estimated_cost_usd", "actual_cost_usd",
    "cost_status", "first_seen", "last_seen",
)
SESSION_COLUMNS = (
    "id", "source", "title", "cwd", "git_branch", "message_count", "tool_call_count",
)


def get_setting(session: Session, key: str, default: str = "") -> str:
    from backend.models import Setting

    row = session.get(Setting, key)
    return row.value if row is not None and row.value is not None else default


def set_setting(session: Session, key: str, value: str) -> None:
    from backend.models import Setting

    row = session.get(Setting, key)
    if row is None:
        row = Setting(key=key, value=value)
    else:
        row.value = value
    session.add(row)


def is_enabled(session: Session) -> bool:
    """Hermes sync is local-only and on by default; only an explicit "false"
    (or 0/no/off) disables it."""
    return get_setting(session, SYNC_ENABLED_KEY, "true").strip().lower() in ("true", "1", "yes", "on")


def hermes_home() -> Path:
    env = os.environ.get("COMPANION_HERMES_HOME", "").strip()
    if env:
        return Path(env)
    local = os.environ.get("LOCALAPPDATA", "").strip()
    if local:
        candidate = Path(local) / "hermes"
        if candidate.is_dir():
            return candidate
    return Path.home() / ".hermes"


def discover_profile_dbs(home: Path) -> list[tuple[str, Path]]:
    """Return [(profile_name, state.db path)] for the default profile and
    every bot profile under profiles/."""
    dbs: list[tuple[str, Path]] = []
    default_db = home / "state.db"
    if default_db.is_file():
        dbs.append(("default", default_db))
    profiles_dir = home / "profiles"
    if profiles_dir.is_dir():
        for child in sorted(profiles_dir.iterdir(), key=lambda p: p.name):
            if child.name.startswith("."):  # e.g. .deleted — retired profiles
                continue
            db = child / "state.db"
            if child.is_dir() and db.is_file():
                dbs.append((child.name, db))
    return dbs


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    if not conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone():
        return set()
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _read(db_path: Path, readonly: bool) -> list[dict[str, Any]]:
    if readonly:
        conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True, timeout=10)
    else:
        conn = sqlite3.connect(db_path.as_posix(), timeout=10)
    with closing(conn):
        # Guard against accidental writes even on the fallback connection —
        # this module only ever issues SELECTs.
        conn.execute("PRAGMA query_only=1")
        usage_cols = _table_columns(conn, "session_model_usage")
        if "session_id" not in usage_cols:
            return []
        selected_usage = [c for c in USAGE_COLUMNS if c in usage_cols]
        session_cols = _table_columns(conn, "sessions")
        selected_session = [c for c in SESSION_COLUMNS if c in session_cols and c != "id"]
        select_parts = [f"u.{c}" for c in selected_usage]
        join = ""
        if selected_session:
            select_parts += [f"s.{c}" for c in selected_session]
            join = " LEFT JOIN sessions s ON s.id = u.session_id"
        names = list(selected_usage) + [f"session_{c}" for c in selected_session]
        sql = f"SELECT {', '.join(select_parts)} FROM session_model_usage u{join}"
        return [dict(zip(names, raw)) for raw in conn.execute(sql)]


def read_profile_usage(db_path: Path) -> list[dict[str, Any]]:
    """Return usage rows for one profile. Raises sqlite3.Error / OSError."""
    try:
        return _read(db_path, readonly=True)
    except sqlite3.OperationalError:
        # Read-only WAL access needs the -shm file; a stopped gateway may
        # leave a database without one. The fallback only ever issues SELECTs.
        return _read(db_path, readonly=False)


def _to_float(v: Any) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _to_int(v: Any) -> int | None:
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _row_timestamp(row: dict[str, Any]) -> datetime | None:
    ts = row.get("last_seen") or row.get("first_seen")
    if isinstance(ts, (int, float)) and ts > 0:
        return datetime.fromtimestamp(ts, tz=UTC).replace(tzinfo=None)
    return None


def _external_id(profile: str, row: dict[str, Any]) -> str:
    """Stable id for one usage row. The full Hermes primary key is hashed so
    the id stays short even for long model slugs; profile + session stay
    readable for debugging."""
    pk = "|".join(
        str(row.get(k) or "")
        for k in ("model", "billing_provider", "billing_base_url", "billing_mode", "task")
    )
    digest = hashlib.sha1(pk.encode("utf-8")).hexdigest()[:16]
    return f"{EXTERNAL_ID_PREFIX}{profile}:{row.get('session_id') or '?'}:{digest}"


def _task_marker(task: str) -> str:
    return f"auto-imported (hermes:{task})" if task else "auto-imported (hermes)"


def _row_cost(row: dict[str, Any], slug: str | None = None) -> float:
    """Cost for one usage row: measured rates win, stored estimate is the fallback."""
    measured = measured_cost(
        slug,
        input_tokens=_to_int(row.get("input_tokens")),
        output_tokens=_to_int(row.get("output_tokens")),
        cache_read_tokens=_to_int(row.get("cache_read_tokens")),
        cache_write_tokens=_to_int(row.get("cache_write_tokens")),
    )
    if measured is not None:
        return measured
    actual = _to_float(row.get("actual_cost_usd")) or 0.0
    estimated = _to_float(row.get("estimated_cost_usd")) or 0.0
    return actual if actual > 0 else estimated


def _build_notes(profile: str, row: dict[str, Any]) -> str:
    source = row.get("session_source") or "unknown"
    lines = [f"Hermes profile: {profile} · source: {source}"]
    title = (row.get("session_title") or "").strip()
    if title:
        lines.append(f"session: {title[:200]}")
    bits: list[str] = []
    msg = _to_int(row.get("session_message_count"))
    if msg is not None:
        bits.append(f"{msg} msgs")
    tools = _to_int(row.get("session_tool_call_count"))
    if tools is not None:
        bits.append(f"{tools} tool calls")
    cwd = (row.get("session_cwd") or "").strip()
    if cwd:
        bits.append(f"cwd: {cwd[:160]}")
    branch = (row.get("session_git_branch") or "").strip()
    if branch:
        bits.append(f"branch: {branch}")
    if bits:
        lines.append(" · ".join(bits))
    return "\n".join(lines)[:NOTES_MAX]


def _ensure_model(
    session: Session, slug: str, vendor: str | None, model_map: dict[str, Model]
) -> tuple[Model | None, bool]:
    """Return the Model for a Hermes slug, creating it on first sight.

    Hermes models are cloud API models consumed agentically, so they are
    registered as kind=web with the observed billing provider as vendor.
    Without this every synced row lands in the "Unknown" spend bucket and
    stays invisible to the leaderboard and the History model filter.
    """
    matched = _match_model(slug, model_map)
    if matched is not None:
        return matched, False
    model = Model(
        name=slug[:200],
        kind=ModelKind.web,
        vendor=(vendor or "").strip()[:200] or None,
        is_active=True,
    )
    session.add(model)
    session.flush()
    model_map[model.name.lower()] = model
    if "/" in model.name:
        model_map.setdefault(model.name.split("/")[-1].lower(), model)
    return model, True


def _entry_fields(
    profile: str, row: dict[str, Any], model_map: dict[str, Model]
) -> dict[str, Any] | None:
    """Build the LogEntry field dict for one usage row, or None when the row
    carries nothing worth importing."""
    model_slug = str(row.get("model") or "").strip()
    matched = _match_model(model_slug, model_map) if model_slug else None
    in_tok = _to_int(row.get("input_tokens"))
    out_tok = _to_int(row.get("output_tokens"))
    cache_read = _to_int(row.get("cache_read_tokens"))
    cache_write = _to_int(row.get("cache_write_tokens"))
    reasoning = _to_int(row.get("reasoning_tokens"))
    cost = _row_cost(row, model_slug)
    if matched is None and not model_slug and not any(
        (in_tok, out_tok, cache_read, cache_write, reasoning, cost)
    ):
        return None

    fields: dict[str, Any] = {
        "task_description": _task_marker(str(row.get("task") or "")),
        "session_title": (str(row.get("session_title") or "").strip() or None),
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "cache_read_tokens": cache_read,
        "cache_write_tokens": cache_write,
        "reasoning_tokens": reasoning,
        "cost_usd": cost,
        "notes": _build_notes(profile, row),
        "origin": "hermes",
        "external_id": _external_id(profile, row),
    }
    if matched is not None:
        fields["model_id"] = matched.id
    if model_slug:
        # Keep the raw slug alongside the FK: it is the provenance of the row
        # and the only name available when the model row is later deleted.
        fields["model_name_text"] = model_slug[:200]
    return fields


_UPDATABLE_FIELDS = (
    "model_id", "model_name_text", "task_description", "session_title", "input_tokens",
    "output_tokens", "cache_read_tokens", "cache_write_tokens",
    "reasoning_tokens", "cost_usd", "notes",
)


def run_sync(session: Session, home: Path | None = None) -> dict[str, Any]:
    """Full sync cycle across every discovered profile. Returns a UI-safe
    summary dict."""
    root = home or hermes_home()
    dbs = discover_profile_dbs(root)
    if not dbs:
        return {"ok": False, "error": f"No Hermes state.db found under {root}."}

    model_map = _load_model_map(session)
    existing: dict[str, LogEntry] = {
        e.external_id: e
        for e in session.exec(
            select(LogEntry).where(LogEntry.external_id.like(f"{EXTERNAL_ID_PREFIX}%"))
        ).all()
    }

    profiles: list[dict[str, Any]] = []
    totals = {
        "rows_seen": 0, "created": 0, "updated": 0, "unchanged": 0, "errors": 0,
        "models_created": 0,
    }

    for name, db_path in dbs:
        summary: dict[str, Any] = {
            "profile": name, "rows": 0, "created": 0, "updated": 0, "unchanged": 0,
        }
        try:
            rows = read_profile_usage(db_path)
        except (sqlite3.Error, OSError) as exc:
            logger.warning("hermes sync: cannot read %s: %s", db_path, exc)
            summary["error"] = "unreadable state.db"
            totals["errors"] += 1
            profiles.append(summary)
            continue

        summary["rows"] = len(rows)
        for row in rows:
            slug = str(row.get("model") or "").strip()
            if slug:
                _, created_model = _ensure_model(
                    session, slug, str(row.get("billing_provider") or ""), model_map
                )
                if created_model:
                    totals["models_created"] += 1
            fields = _entry_fields(name, row, model_map)
            if fields is None:
                totals["errors"] += 1
                continue
            entry = existing.get(fields["external_id"])
            if entry is None:
                entry = LogEntry(**fields)
                ts = _row_timestamp(row)
                if ts is not None:
                    entry.created_at = ts
                session.add(entry)
                existing[fields["external_id"]] = entry
                totals["created"] += 1
                summary["created"] += 1
            else:
                changed = False
                for key in _UPDATABLE_FIELDS:
                    if getattr(entry, key) != fields.get(key):
                        setattr(entry, key, fields.get(key))
                        changed = True
                if changed:
                    totals["updated"] += 1
                    summary["updated"] += 1
                else:
                    totals["unchanged"] += 1
                    summary["unchanged"] += 1
        totals["rows_seen"] += len(rows)
        profiles.append(summary)

    session.commit()

    now_str = datetime.now(UTC).replace(tzinfo=None).isoformat()
    set_setting(session, LAST_SYNC_KEY, now_str)
    session.commit()

    result = {"ok": True, "last_sync_at": now_str, **totals, "profiles": profiles}
    logger.info(
        "hermes sync: %s", {k: v for k, v in result.items() if k != "profiles"}
    )
    return result
