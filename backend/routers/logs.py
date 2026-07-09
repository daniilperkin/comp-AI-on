from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import LogEntry, LogEntryCreate, LogEntryUpdate

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("")
def list_logs(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    model_id: Optional[int] = None,
    category_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    stmt = select(LogEntry).order_by(LogEntry.created_at.desc())
    if model_id is not None:
        stmt = stmt.where(LogEntry.model_id == model_id)
    if category_id is not None:
        stmt = stmt.where(LogEntry.category_id == category_id)
    stmt = stmt.offset(offset).limit(limit)
    return session.exec(stmt).all()


@router.get("/{log_id}")
def get_log(log_id: int, session: Session = Depends(get_session)):
    entry = session.get(LogEntry, log_id)
    if entry is None:
        raise HTTPException(404, "Log entry not found")
    return entry


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
