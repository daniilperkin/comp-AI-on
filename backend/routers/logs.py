import csv
import io
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, func, select

from backend.db import get_session
from backend.models import Category, LogEntry, LogEntryCreate, LogEntryUpdate, Model

router = APIRouter(prefix="/api/logs", tags=["logs"])


def _apply_filters(stmt, model_id: Optional[int], category_id: Optional[int]):
    if model_id is not None:
        stmt = stmt.where(LogEntry.model_id == model_id)
    if category_id is not None:
        stmt = stmt.where(LogEntry.category_id == category_id)
    return stmt


@router.get("")
def list_logs(
    response: Response,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    model_id: Optional[int] = None,
    category_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    count_stmt = _apply_filters(select(func.count(LogEntry.id)), model_id, category_id)
    total = session.exec(count_stmt).one()

    stmt = _apply_filters(
        select(LogEntry).order_by(LogEntry.created_at.desc()),
        model_id,
        category_id,
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
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


CSV_COLUMNS = [
    "id", "created_at", "model", "category", "task_description",
    "quality_score", "outcome", "input_tokens", "output_tokens",
    "cost_usd", "latency_ms", "notes",
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
            "quality_score": e.quality_score if e.quality_score is not None else "",
            "outcome": e.outcome.value if e.outcome else "",
            "input_tokens": e.input_tokens if e.input_tokens is not None else "",
            "output_tokens": e.output_tokens if e.output_tokens is not None else "",
            "cost_usd": e.cost_usd if e.cost_usd is not None else "",
            "latency_ms": e.latency_ms if e.latency_ms is not None else "",
            "notes": e.notes or "",
        })
    return rows


def _export_rows(session: Session, model_id: Optional[int], category_id: Optional[int]) -> list[dict]:
    stmt = _apply_filters(
        select(LogEntry).order_by(LogEntry.created_at.desc()),
        model_id,
        category_id,
    )
    entries = session.exec(stmt).all()
    return _resolve_names(session, list(entries))


@router.get("/export/csv")
def export_csv(
    model_id: Optional[int] = None,
    category_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    rows = _export_rows(session, model_id, category_id)

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
    model_id: Optional[int] = None,
    category_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    rows = _export_rows(session, model_id, category_id)

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
    return None
