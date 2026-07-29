from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case
from sqlmodel import Session, func, select

from backend.db import get_session
from backend.models import Category, LogEntry, Model, Outcome

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _load_models(session: Session, model_ids) -> dict[int, Model]:
    ids = [mid for mid in model_ids if mid is not None]
    if not ids:
        return {}
    rows = session.exec(select(Model).where(Model.id.in_(ids))).all()
    return {m.id: m for m in rows}


def _load_categories(session: Session, category_ids) -> dict[int, Category]:
    ids = [cid for cid in category_ids if cid is not None]
    if not ids:
        return {}
    rows = session.exec(select(Category).where(Category.id.in_(ids))).all()
    return {c.id: c for c in rows}


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

    model_map = _load_models(session, [r[0] for r in rows])
    top_models = []
    for model_id, avg_q, entries in rows:
        if model_id is None:
            continue
        m = model_map.get(model_id)
        if m:
            top_models.append({"model": m, "avg_quality": round(avg_q, 2), "entries": entries})

    return {
        "total_entries": total,
        "avg_quality": round(avg_quality, 2) if avg_quality is not None else None,
        "success_rate": round(solved / total, 2) if total > 0 else None,
        "last_7_days": last_7_days,
        "top_models": top_models,
    }


@router.get("/timeline")
def timeline(
    days: int | None = Query(default=None, ge=1, le=3650),
    session: Session = Depends(get_session),
):
    stmt = select(
        func.date(LogEntry.created_at).label("date"),
        func.count(LogEntry.id).label("count"),
        func.avg(LogEntry.quality_score).label("avg_quality"),
    ).group_by(func.date(LogEntry.created_at)).order_by(func.date(LogEntry.created_at))

    if days is not None:
        cutoff = datetime.utcnow() - timedelta(days=days)
        stmt = stmt.where(LogEntry.created_at >= cutoff)

    rows = session.exec(stmt).all()

    return [
        {
            "date": row.date,
            "count": row.count,
            "avg_quality": round(row.avg_quality, 2) if row.avg_quality is not None else None,
        }
        for row in rows
    ]


@router.get("/leaderboard")
def leaderboard(session: Session = Depends(get_session)):
    rows = session.exec(
        select(
            LogEntry.model_id,
            func.avg(LogEntry.quality_score).label("avg_quality"),
            func.count(LogEntry.id).label("entries"),
            func.sum(case((LogEntry.outcome == Outcome.solved, 1), else_=0)).label("solved"),
        )
        .where(LogEntry.model_id.is_not(None))
        .group_by(LogEntry.model_id)
        .order_by(func.avg(LogEntry.quality_score).desc())
    ).all()

    model_map = _load_models(session, [r[0] for r in rows])
    result = []
    for model_id, avg_q, entries, solved in rows:
        if model_id is None:
            continue
        m = model_map.get(model_id)
        if m:
            result.append({
                "model": m,
                "avg_quality": round(avg_q, 2) if avg_q is not None else None,
                "entries": entries,
                "success_rate": round(solved / entries, 2) if entries > 0 else None,
            })

    return result


@router.get("/matrix")
def matrix(session: Session = Depends(get_session)):
    rows = session.exec(
        select(
            LogEntry.model_id,
            LogEntry.category_id,
            func.avg(LogEntry.quality_score).label("avg_quality"),
            func.count(LogEntry.id).label("entries"),
        )
        .where(
            LogEntry.model_id.is_not(None),
            LogEntry.category_id.is_not(None),
            LogEntry.quality_score.is_not(None),
        )
        .group_by(LogEntry.model_id, LogEntry.category_id)
    ).all()

    model_map = _load_models(session, [r[0] for r in rows])
    category_map = _load_categories(session, [r[1] for r in rows])

    cells = []
    for model_id, category_id, avg_q, entries in rows:
        m = model_map.get(model_id)
        c = category_map.get(category_id)
        if m and c:
            cells.append({
                "model_id": model_id,
                "model_name": m.name,
                "category_id": category_id,
                "category_name": c.name,
                "category_color": c.color,
                "avg_quality": round(avg_q, 2),
                "entries": entries,
            })

    models = session.exec(select(Model).where(Model.is_active == True).order_by(Model.name)).all()
    categories = session.exec(select(Category).order_by(Category.name)).all()

    return {
        "models": models,
        "categories": categories,
        "cells": cells,
    }
