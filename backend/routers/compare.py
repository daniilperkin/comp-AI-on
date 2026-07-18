from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import Category, LogEntry, Model, Outcome

router = APIRouter(prefix="/api/compare", tags=["compare"])


@router.get("")
def compare(
    model_ids: str = Query(..., description="Comma-separated model IDs, e.g. '1,2,3'"),
    session: Session = Depends(get_session),
):
    """Side-by-side comparison of 2+ models across all categories.

    For each model returns: overall avg quality, success rate, total entries,
    avg latency, total cost, and per-category breakdown.
    """
    try:
        ids = [int(x.strip()) for x in model_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "model_ids must be comma-separated integers")

    if len(ids) < 2:
        raise HTTPException(400, "Provide at least 2 model IDs to compare")
    if len(ids) > 10:
        raise HTTPException(400, "Cannot compare more than 10 models at once")

    models = session.exec(select(Model).where(Model.id.in_(ids))).all()
    model_map = {m.id: m for m in models}
    missing_ids = set(ids) - set(model_map.keys())
    if missing_ids:
        raise HTTPException(404, f"Models not found: {sorted(missing_ids)}")

    results = []
    for mid in ids:
        rows = session.exec(
            select(
                func.avg(LogEntry.quality_score).label("avg_quality"),
                func.count(LogEntry.id).label("entries"),
                func.sum(case((LogEntry.outcome == Outcome.solved, 1), else_=0)).label("solved"),
                func.avg(LogEntry.latency_ms).label("avg_latency"),
                func.sum(LogEntry.cost_usd).label("total_cost"),
            )
            .where(LogEntry.model_id == mid)
        ).one()

        avg_q, entries, solved, avg_latency, total_cost = rows
        success_rate = float(solved) / float(entries) if entries and entries > 0 else None

        cat_rows = session.exec(
            select(
                LogEntry.category_id,
                func.avg(LogEntry.quality_score).label("avg_quality"),
                func.count(LogEntry.id).label("entries"),
            )
            .where(LogEntry.model_id == mid, LogEntry.category_id.is_not(None))
            .group_by(LogEntry.category_id)
        ).all()

        category_ids = [r[0] for r in cat_rows if r[0] is not None]
        cat_map: dict[int, Category] = {}
        if category_ids:
            cats = session.exec(select(Category).where(Category.id.in_(category_ids))).all()
            cat_map = {c.id: c for c in cats}

        per_category = []
        for cat_id, cat_avg_q, cat_entries in cat_rows:
            if cat_id is None:
                continue
            c = cat_map.get(cat_id)
            if c:
                per_category.append({
                    "category_id": cat_id,
                    "category_name": c.name,
                    "category_color": c.color,
                    "avg_quality": round(float(cat_avg_q), 2) if cat_avg_q is not None else None,
                    "entries": cat_entries,
                })

        per_category.sort(key=lambda x: x["category_name"])

        results.append({
            "model": model_map[mid],
            "avg_quality": round(float(avg_q), 2) if avg_q is not None else None,
            "entries": entries,
            "success_rate": round(success_rate, 2) if success_rate is not None else None,
            "avg_latency_ms": round(float(avg_latency), 0) if avg_latency is not None else None,
            "total_cost_usd": round(float(total_cost), 4) if total_cost is not None else None,
            "per_category": per_category,
        })

    return {"models": results}
