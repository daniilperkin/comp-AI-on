import csv
import io
import json
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_
from sqlmodel import Session, func, select

from backend.budget import check_budget
from backend.costing import derive_cost
from backend.db import get_session
from backend.models import Category, LogEntry, LogEntryCreate, LogEntryUpdate, Model
from backend.notify import (
    send_browser_notification,
    send_discord_webhook,
    send_telegram_webhook,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/logs", tags=["logs"])


def _apply_filters(
    stmt,
    model_id: int | None,
    category_id: int | None,
    unrated: bool = False,
    origin: str | None = None,
    q: str | None = None,
):
    if model_id is not None:
        stmt = stmt.where(LogEntry.model_id == model_id)
    if category_id is not None:
        stmt = stmt.where(LogEntry.category_id == category_id)
    if unrated:
        stmt = stmt.where(LogEntry.quality_score.is_(None))
    if origin:
        stmt = stmt.where(LogEntry.origin == origin)
    if q and q.strip():
        # Free-text search across the human-readable fields. ilike() gives
        # case-insensitive matching on SQLite (LIKE is case-insensitive for
        # ASCII there anyway, but this keeps the intent explicit).
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                LogEntry.task_description.ilike(like),
                LogEntry.session_title.ilike(like),
                LogEntry.model_name_text.ilike(like),
                LogEntry.notes.ilike(like),
            )
        )
    return stmt


def _parse_date(name: str, value: str | None) -> datetime | None:
    """Parse a YYYY-MM-DD filter param. Naive UTC — matches created_at storage."""
    if value is None:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, f"{name} must be YYYY-MM-DD, got {value!r}")


def _apply_date_filters(
    stmt,
    date_from: datetime | None,
    date_to: datetime | None,
):
    # date_to is inclusive: entries ON that day must match, so compare
    # against midnight of the NEXT day.
    if date_from is not None:
        stmt = stmt.where(LogEntry.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(LogEntry.created_at < date_to + timedelta(days=1))
    return stmt


@router.get("")
def list_logs(
    response: Response,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    model_id: int | None = None,
    category_id: int | None = None,
    unrated: bool = Query(False),
    origin: str | None = None,
    q: str | None = Query(None, max_length=200),
    date_from: str | None = None,
    date_to: str | None = None,
    session: Session = Depends(get_session),
):
    parsed_from = _parse_date("date_from", date_from)
    parsed_to = _parse_date("date_to", date_to)

    count_stmt = _apply_date_filters(
        _apply_filters(
            select(func.count(LogEntry.id)), model_id, category_id, unrated, origin, q
        ),
        parsed_from,
        parsed_to,
    )
    total = session.exec(count_stmt).one()

    stmt = _apply_date_filters(
        _apply_filters(
            select(LogEntry).order_by(LogEntry.created_at.desc()),
            model_id,
            category_id,
            unrated,
            origin,
            q,
        ),
        parsed_from,
        parsed_to,
    )
    entries = session.exec(stmt.offset(offset).limit(limit)).all()

    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)
    return entries


@router.post("", status_code=201)
def create_log(payload: LogEntryCreate, session: Session = Depends(get_session)):
    data = payload.model_dump(exclude_unset=True)
    has_id = any(
        data.get(k) not in (None, "")
        for k in ("model_id", "model_name_text", "category_id", "category_name_text", "task_description")
    )
    if not has_id:
        raise HTTPException(400, "Provide at least a model, category, or task description")
    entry = LogEntry(**data)
    entry.origin = "manual"
    session.add(entry)
    session.commit()
    session.refresh(entry)

    # Budget check happens after the entry is safely stored — a budget crash
    # must never lose the user's log. Fires at most once per day.
    try:
        event = check_budget(session)
        if event:
            send_browser_notification(session, event["title"], event["body"])
            send_discord_webhook(session, event["title"], event["body"])
            send_telegram_webhook(session, event["title"], event["body"])
    except Exception:
        logger.exception("budget check failed after log creation")

    return entry


CSV_COLUMNS = [
    "id", "created_at", "model", "category", "task_description", "session_title",
    "quality_score", "outcome", "input_tokens", "output_tokens",
    "cost_usd", "derived_cost_usd", "latency_ms", "notes",
]


def _resolve_names(session: Session, entries: list[LogEntry]) -> list[dict]:
    model_cache: dict[int, str] = {}
    cat_cache: dict[int, tuple[str, str | None]] = {}

    rows = []
    for e in entries:
        model_name = e.model_name_text or ""
        if e.model_id:
            if e.model_id not in model_cache:
                m = session.get(Model, e.model_id)
                model_cache[e.model_id] = m.name if m else ""
            model_name = model_cache[e.model_id]

        category_name = e.category_name_text or ""
        if e.category_id:
            if e.category_id not in cat_cache:
                c = session.get(Category, e.category_id)
                cat_cache[e.category_id] = (c.name, c.color) if c else ("", None)
            category_name = cat_cache[e.category_id][0]

        rows.append({
            "id": e.id,
            "created_at": e.created_at.isoformat() if e.created_at else "",
            "model": model_name,
            "category": category_name,
            "task_description": e.task_description or "",
            "session_title": e.session_title or "",
            "quality_score": e.quality_score if e.quality_score is not None else "",
            "outcome": e.outcome.value if e.outcome else "",
            "input_tokens": e.input_tokens if e.input_tokens is not None else "",
            "output_tokens": e.output_tokens if e.output_tokens is not None else "",
            "cost_usd": e.cost_usd if e.cost_usd is not None else "",
            "latency_ms": e.latency_ms if e.latency_ms is not None else "",
            "notes": e.notes or "",
        })
    return rows


def _export_rows(
    session: Session,
    model_id: int | None,
    category_id: int | None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    unrated: bool = False,
) -> list[dict]:
    stmt = _apply_filters(
        select(LogEntry).order_by(LogEntry.created_at.desc()),
        model_id,
        category_id,
        unrated,
        None,
        q,
    )
    stmt = _apply_date_filters(stmt, date_from, date_to)
    entries = session.exec(stmt).all()

    model_map: dict[int, Model] = {}
    if entries:
        ids = {e.model_id for e in entries if e.model_id is not None}
        if ids:
            model_map = {
                m.id: m for m in session.exec(select(Model).where(Model.id.in_(ids))).all()
            }

    rows = _resolve_names(session, list(entries))
    # Attach derived cost (explicit cost wins; else tokens x model prices).
    for row, entry in zip(rows, entries):
        m = model_map.get(entry.model_id) if entry.model_id is not None else None
        row["derived_cost_usd"] = derive_cost(entry, m)
    return rows


@router.get("/export/csv")
def export_csv(
    model_id: int | None = None,
    category_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    q: str | None = None,
    unrated: bool = False,
    session: Session = Depends(get_session),
):
    rows = _export_rows(
        session, model_id, category_id,
        _parse_date("date_from", date_from), _parse_date("date_to", date_to),
        q, unrated,
    )

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    writer.writerows(rows)

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=companion-logs.csv"},
    )


@router.get("/export/json")
def export_json(
    model_id: int | None = None,
    category_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    q: str | None = None,
    unrated: bool = False,
    session: Session = Depends(get_session),
):
    rows = _export_rows(
        session, model_id, category_id,
        _parse_date("date_from", date_from), _parse_date("date_to", date_to),
        q, unrated,
    )

    return Response(
        content=json.dumps(rows, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=companion-logs.json"},
    )


@router.get("/{log_id}")
def get_log(log_id: int, session: Session = Depends(get_session)):
    entry = session.get(LogEntry, log_id)
    if entry is None:
        raise HTTPException(404, "Log entry not found")
    return entry


@router.patch("/{log_id}")
def update_log(log_id: int, payload: LogEntryUpdate, session: Session = Depends(get_session)):
    entry = session.get(LogEntry, log_id)
    if entry is None:
        raise HTTPException(404, "Log entry not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(entry, k, v)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/{log_id}", status_code=204)
def delete_log(log_id: int, session: Session = Depends(get_session)):
    entry = session.get(LogEntry, log_id)
    if entry is None:
        raise HTTPException(404, "Log entry not found")
    session.delete(entry)
    session.commit()
