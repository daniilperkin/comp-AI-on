"""OpenRouter usage sync — pull real API activity into log entries.

Design:
- fetch_activity() talks to OpenRouter (mockable boundary; the only place
  that knows HTTP details).
- filter_new() drops generations already imported (matched by external_id).
- to_log_entry_create() maps one generation to a LogEntryCreate; synced rows
  carry task_description="auto-imported" so users can filter and later
  attach quality scores.
- run_sync() orchestrates: config check -> fetch -> dedupe -> insert ->
  update last_sync setting -> return summary.

The exact response shape of OpenRouter's activity endpoint is treated as
flexible on purpose: _extract_generations() accepts both a bare list and
{"data": [...]} envelopes, and reads token/cost fields tolerantly. Verify
with a live call before relying on exotic fields.
"""
import logging
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlmodel import Session, select

from backend.models import LogEntryCreate, Model

logger = logging.getLogger(__name__)

ACTIVITY_URL = "https://openrouter.ai/api/v1/activity"
SYNC_ENABLED_KEY = "openrouter_sync_enabled"
API_KEY_KEY = "openrouter_api_key"
LAST_SYNC_KEY = "last_sync_at"
AUTO_IMPORT_MARKER = "auto-imported"
FETCH_TIMEOUT_S = 30


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


def is_configured(session: Session) -> bool:
    """Sync runs when enabled AND a key is present."""
    return (
        get_setting(session, SYNC_ENABLED_KEY).lower() == "true"
        and bool(get_setting(session, API_KEY_KEY))
    )


def fetch_activity(api_key: str, days_back: int = 7) -> list[dict[str, Any]]:
    """Fetch recent generations from OpenRouter. Raises RuntimeError on
    transport/auth failure with a message safe to show in the UI."""
    # /activity returns the last 30 completed UTC days, one row per
    # (date, model endpoint); there is no "since" param, so filter locally.
    cutoff = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    try:
        resp = httpx.get(
            ACTIVITY_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=FETCH_TIMEOUT_S,
        )
    except httpx.HTTPError as exc:
        # Don't interpolate exc: some httpx errors echo request details.
        raise RuntimeError("Could not reach OpenRouter.") from exc
    if resp.status_code == 401:
        raise RuntimeError("OpenRouter rejected the API key (401). Check Settings.")
    if resp.status_code != 200:
        raise RuntimeError(f"OpenRouter returned {resp.status_code}.")
    data = resp.json()
    # Tolerate bare-list or {"data": [...]} envelope shapes.
    rows = data.get("data") if isinstance(data, dict) else data
    if isinstance(rows, list):
        return [
            r for r in rows
            if isinstance(r, dict)
            and (not isinstance(r.get("date"), str) or r["date"][:10] >= cutoff)
        ]
    raise RuntimeError("Unexpected OpenRouter activity response shape.")


def _generation_id(gen: dict[str, Any]) -> str | None:
    for key in ("id", "generation_id", "uid"):
        v = gen.get(key)
        if isinstance(v, str | int):
            return str(v)
    # Activity rows are daily aggregates without an id: key them by
    # date + model endpoint, which is unique per row and stable across syncs.
    date = gen.get("date")
    if isinstance(date, str) and date:
        ep = gen.get("endpoint_id") or gen.get("model_permaslug") or gen.get("model") or ""
        return f"or-activity:{date[:10]}:{ep}"
    return None


def filter_new(
    session: Session, generations: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], int]:
    """Split into (new, skipped_count). Generations without an ID can't be
    deduped and are treated as new — flagged by run_sync's summary."""
    from backend.models import LogEntry

    known: set[str] = set(
        session.exec(
            select(LogEntry.external_id).where(LogEntry.external_id.is_not(None))
        ).all()
    )
    new = []
    skipped = 0
    for gen in generations:
        gid = _generation_id(gen)
        if gid is not None and gid in known:
            skipped += 1
        else:
            new.append(gen)
    return new, skipped


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


def _gen_timestamp(gen: dict[str, Any]) -> datetime | None:
    raw = (
        gen.get("created_at") or gen.get("startTime") or gen.get("created") or gen.get("date")
    )
    if isinstance(raw, (int, float)):
        # Epoch seconds vs milliseconds heuristics.
        ts = datetime.utcfromtimestamp(raw / 1000 if raw > 1e11 else raw)
        return ts.replace(tzinfo=None)
    if isinstance(raw, str):
        for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt.replace(tzinfo=None)
        except ValueError:
            return None
    return None


def to_log_entry_create(
    gen: dict[str, Any], model_map: dict[str, Model]
) -> tuple[LogEntryCreate, datetime | None] | None:
    """Map an OpenRouter generation dict to (LogEntryCreate, created_at).

    created_at is returned separately because LogEntryCreate doesn't expose
    the column. Returns None when the generation has neither a usable model
    name nor any usage data — nothing worth logging.
    """
    model_slug = gen.get("model") or gen.get("model_name") or ""
    matched = _match_model(model_slug if isinstance(model_slug, str) else "", model_map)
    model_id: int | None = None
    model_text: str | None = None

    if isinstance(model_slug, str) and model_slug:
        if matched:
            model_id = matched.id
        else:
            model_text = model_slug[:200]

    raw_usage = gen.get("token_usage") or gen.get("usage")
    usage = raw_usage if isinstance(raw_usage, dict) else {}
    in_tok = _to_int(usage.get("prompt") if usage else None) or _to_int(
        gen.get("tokens_prompt", gen.get("prompt_tokens"))
    )
    out_tok = _to_int(usage.get("completion") if usage else None) or _to_int(
        gen.get("tokens_completion", gen.get("completion_tokens"))
    )
    cost = _to_float((usage or {}).get("cost") if usage else None) or _to_float(
        gen.get("cost", None if isinstance(raw_usage, dict) else raw_usage)
    )

    if model_id is None and not model_text and in_tok is None and out_tok is None and cost is None:
        return None

    ts = _gen_timestamp(gen)
    gid = _generation_id(gen)

    kwargs: dict[str, Any] = {
        "task_description": AUTO_IMPORT_MARKER,
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "cost_usd": cost,
        "external_id": gid,
    }
    if model_id is not None:
        kwargs["model_id"] = model_id
    if model_text is not None:
        kwargs["model_name_text"] = model_text

    try:
        return LogEntryCreate(**kwargs), ts
    except Exception:
        logger.warning("failed to build LogEntryCreate from generation %s", gid)
        return None


def _load_model_map(session: Session) -> dict[str, Model]:
    """Map OpenRouter slugs AND display names to local Model rows.

    A local model matches a generation when either its full name equals the
    slug, or its name equals the slug's tail segment (vendor/model-name).
    """
    models = session.exec(select(Model)).all()
    mapping: dict[str, Model] = {}
    for m in models:
        mapping[m.name.lower()] = m
        if "/" in m.name:
            mapping[m.name.split("/")[-1].lower()] = m
    return mapping


def _match_model(model_slug: str, model_map: dict[str, Model]) -> Model | None:
    """Match a generation's model slug to a local Model, trying the full slug
    and then its tail segment."""
    slug = (model_slug or "").strip().lower()
    if not slug:
        return None
    if slug in model_map:
        return model_map[slug]
    if "/" in slug:
        return model_map.get(slug.split("/")[-1])
    return None


def run_sync(session: Session, days_back: int = 7) -> dict[str, Any]:
    """Full sync cycle. Returns a UI-safe summary dict."""
    api_key = get_setting(session, API_KEY_KEY)
    if not api_key:
        return {"ok": False, "error": "No OpenRouter API key configured (Settings)."}

    try:
        generations = fetch_activity(api_key, days_back)
    except RuntimeError as exc:
        return {"ok": False, "error": str(exc)}

    new_gens, skipped = filter_new(session, generations)
    model_map = _load_model_map(session)

    created = 0
    errors = 0
    seen_ids: set[str] = set()
    for gen in new_gens:
        mapped = to_log_entry_create(gen, model_map)
        if mapped is None:
            errors += 1
            continue
        payload, ts = mapped
        from backend.models import LogEntry

        row = LogEntry(**payload.dict())
        if ts is not None:
            row.created_at = ts  # preserve the real call time, not sync time
        gid = _generation_id(gen)
        if gid and gid not in seen_ids:
            row.external_id = gid
            seen_ids.add(gid)
        session.add(row)
        created += 1
    session.commit()

    now_str = datetime.utcnow().isoformat()
    set_setting(session, LAST_SYNC_KEY, now_str)
    session.commit()

    result: dict[str, Any] = {
        "ok": True,
        "fetched": len(generations),
        "created": created,
        "skipped_existing": skipped,
        "errors": errors,
        "last_sync_at": now_str,
    }
    logger.info("openrouter sync: %s", result)
    return result
