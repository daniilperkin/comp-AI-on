from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from backend.db import get_session
from backend.models import Category, LogEntry, Model, Outcome

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def overview(session: Session = Depends(get_session)):
    total = session.exec(select(func.count(LogEntry.id))).one()
    avg_quality = session.exec(select(func.avg(LogEntry.quality_score))).one()
    solved = session.exec(
        select(func.count(LogEntry.id)).where(LogEntry.outcome == Outcome.solved)
    ).one()

    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    last_7_days = session.exec(
        select(func.count(LogEntry.id)).where(LogEntry.created_at >= seven_days_ago)
    ).one()

    rows = session.exec(
        select(
            LogEntry.model_id,
            func.avg(LogEntry.quality_score).label("avg_quality"),
            func.count(LogEntry.id).label("entries"),
        )
        .where(LogEntry.quality_score.is_not(None))
        .group_by(LogEntry.model_id)
        .order_by(func.avg(LogEntry.quality_score).desc())
        .limit(3)
    ).all()

    top_models = []
    for model_id, avg_q, entries in rows:
        if model_id is None:
            continue
        m = session.get(Model, model_id)
        if m:
            top_models.append({"model": m, "avg_quality": round(avg_q, 2), "entries": entries})

    return {
        "total_entries": total,
        "avg_quality": round(avg_quality, 2) if avg_quality is not None else None,
        "success_rate": round(solved / total, 2) if total > 0 else None,
        "last_7_days": last_7_days,
        "top_models": top_models,
    }
