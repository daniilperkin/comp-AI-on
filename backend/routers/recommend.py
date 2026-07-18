from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import Category, LogEntry, Model, Outcome

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


@router.get("")
def recommend(
    category_id: Optional[int] = Query(default=None),
    top_n: int = Query(default=5, ge=1, le=20),
    session: Session = Depends(get_session),
):
    """Recommend the best models for a given category (or globally).

    Uses Bayesian-shrunk average quality:
        score = (v / (v + K)) * avg_quality + (K / (v + K)) * global_avg

    where v = number of entries for this model (in this category or globally),
    K = 5 (prior strength), global_avg = average quality across all entries.

    Also factors in success_rate as a secondary sort key.
    """
    global_avg_row = session.exec(
        select(func.avg(LogEntry.quality_score)).where(LogEntry.quality_score.is_not(None))
    ).one()
    global_avg = float(global_avg_row) if global_avg_row is not None else 5.0

    K = 5.0

    stmt = (
        select(
            LogEntry.model_id,
            func.avg(LogEntry.quality_score).label("avg_quality"),
            func.count(LogEntry.id).label("entries"),
            func.sum(case((LogEntry.outcome == Outcome.solved, 1), else_=0)).label("solved"),
        )
        .where(
            LogEntry.model_id.is_not(None),
            LogEntry.quality_score.is_not(None),
        )
    )

    if category_id is not None:
        stmt = stmt.where(LogEntry.category_id == category_id)

    stmt = stmt.group_by(LogEntry.model_id)

    rows = session.exec(stmt).all()

    model_ids = [r[0] for r in rows if r[0] is not None]
    model_map: dict[int, Model] = {}
    if model_ids:
        models = session.exec(select(Model).where(Model.id.in_(model_ids))).all()
        model_map = {m.id: m for m in models}

    scored = []
    for model_id, avg_q, entries, solved in rows:
        if model_id is None or model_id not in model_map:
            continue
        v = float(entries)
        shrunk = (v / (v + K)) * float(avg_q) + (K / (v + K)) * global_avg
        success_rate = float(solved) / v if v > 0 else 0.0
        scored.append({
            "model": model_map[model_id],
            "avg_quality": round(float(avg_q), 2),
            "entries": entries,
            "success_rate": round(success_rate, 2),
            "score": round(shrunk, 2),
        })

    scored.sort(key=lambda x: (-x["score"], -x["success_rate"], -x["entries"]))
    scored = scored[:top_n]

    category_name = None
    if category_id is not None:
        cat = session.get(Category, category_id)
        if cat:
            category_name = cat.name

    return {
        "category_id": category_id,
        "category_name": category_name,
        "recommendations": scored,
        "global_avg_quality": round(global_avg, 2),
    }
