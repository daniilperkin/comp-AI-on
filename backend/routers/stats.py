from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case
from sqlmodel import Session, func, select

from backend.db import get_session
from backend.models import Category, LogEntry, Model, Outcome

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


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
    outcome_count = session.exec(
        select(func.count(LogEntry.id)).where(LogEntry.outcome.is_not(None))
    ).one()

    seven_days_ago = _utcnow_naive() - timedelta(days=7)
    last_7_days = session.exec(
        select(func.count(LogEntry.id)).where(LogEntry.created_at >= seven_days_ago)
    ).one()

    thirty_days_ago = _utcnow_naive() - timedelta(days=30)

    def _spend_total(where_clause=None) -> float:
        # Explicit cost_usd always wins; token-derived cost needs a join to the
        # priced model. LEFT JOIN keeps unpriced/unknown models in the total
        # with their explicit costs only. COALESCE + SUM yields one row even on
        # an empty table (0.0), so no NoResultFound on a fresh DB.
        stmt = (
            select(
                func.coalesce(
                    func.sum(
                        func.coalesce(
                            LogEntry.cost_usd,
                            LogEntry.input_tokens / 1_000_000 * Model.input_price_per_mtok
                            + LogEntry.output_tokens / 1_000_000 * Model.output_price_per_mtok,
                        )
                    ),
                    0.0,
                ).label("total_cost")
            )
            .select_from(LogEntry)
            .outerjoin(Model, LogEntry.model_id == Model.id)
        )
        if where_clause is not None:
            stmt = stmt.where(where_clause)
        return float(session.exec(stmt).one() or 0.0)

    spend_all_time = _spend_total()
    spend_30d = _spend_total(LogEntry.created_at >= thirty_days_ago)

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
        "success_rate": round(solved / outcome_count, 2) if outcome_count > 0 else None,
        "last_7_days": last_7_days,
        "total_cost_30d": round(spend_30d, 6),
        "total_cost_all_time": round(spend_all_time, 6),
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
        cutoff = _utcnow_naive() - timedelta(days=days)
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
            func.sum(case((LogEntry.outcome.is_not(None), 1), else_=0)).label("rated"),
            func.coalesce(
                func.sum(
                    func.coalesce(
                        LogEntry.cost_usd,
                        LogEntry.input_tokens / 1_000_000 * Model.input_price_per_mtok
                        + LogEntry.output_tokens / 1_000_000 * Model.output_price_per_mtok,
                    )
                ),
                0.0,
            ).label("total_cost"),
        )
        .select_from(LogEntry)
        .outerjoin(Model, LogEntry.model_id == Model.id)
        .where(LogEntry.model_id.is_not(None))
        .group_by(LogEntry.model_id)
        .order_by(func.avg(LogEntry.quality_score).desc())
    ).all()

    model_map = _load_models(session, [r[0] for r in rows])
    result = []
    for model_id, avg_q, entries, solved, rated, total_cost in rows:
        if model_id is None:
            continue
        m = model_map.get(model_id)
        if m:
            result.append({
                "model": m,
                "avg_quality": round(avg_q, 2) if avg_q is not None else None,
                "entries": entries,
                "success_rate": round(solved / rated, 2) if rated > 0 else None,
                "total_cost": round(total_cost or 0.0, 6),
            })

    return result


@router.get("/spend")
def spend(
    days: int | None = Query(default=None, ge=1, le=3650),
    session: Session = Depends(get_session),
):
    """Per-day spend series plus per-model breakdown for the window.

    Cost per entry: explicit cost_usd wins; otherwise derived from token
    counts and the model's per-MTok prices (unknown pricing contributes 0 —
    never guessed). Both aggregations run in Python over one joined row scan
    so unknown-cost entries stay visible instead of being dropped by SQL SUM.
    """
    daily_rows = _daily_spend(session, days)
    by_model = _spend_by_model(session, days)

    return {
        "daily": daily_rows,
        "by_model": by_model,
    }


def _spend_rows(session: Session, days: int | None) -> list[tuple]:
    """One scan of (model_id, explicit_cost, in_tok, out_tok, p_in, p_out)."""
    stmt = select(
        LogEntry.model_id,
        LogEntry.cost_usd.label("explicit_cost"),
        LogEntry.input_tokens,
        LogEntry.output_tokens,
        Model.input_price_per_mtok,
        Model.output_price_per_mtok,
    ).select_from(LogEntry).outerjoin(Model, LogEntry.model_id == Model.id)

    if days is not None:
        cutoff = _utcnow_naive() - timedelta(days=days)
        stmt = stmt.where(LogEntry.created_at >= cutoff)

    return session.exec(stmt).all()


def _entry_cost(explicit, in_tok, out_tok, p_in, p_out) -> float | None:
    """Explicit cost wins; else derive from tokens+prices; else None."""
    if explicit is not None:
        return float(explicit)
    if None in (in_tok, out_tok, p_in, p_out):
        return None
    return in_tok / 1_000_000 * p_in + out_tok / 1_000_000 * p_out


def _daily_spend(session: Session, days: int | None) -> list[dict]:
    """Sum of per-entry costs grouped by day (Python-side; see _spend_by_model)."""
    stmt = select(
        func.date(LogEntry.created_at).label("date"),
        LogEntry.cost_usd.label("explicit_cost"),
        LogEntry.input_tokens,
        LogEntry.output_tokens,
        Model.input_price_per_mtok,
        Model.output_price_per_mtok,
    ).select_from(LogEntry).outerjoin(Model, LogEntry.model_id == Model.id)

    if days is not None:
        cutoff = _utcnow_naive() - timedelta(days=days)
        stmt = stmt.where(LogEntry.created_at >= cutoff)

    totals: dict[str, float] = {}
    for date, explicit, in_tok, out_tok, p_in, p_out in session.exec(stmt).all():
        c = _entry_cost(explicit, in_tok, out_tok, p_in, p_out)
        if c is None:
            continue
        totals[date] = totals.get(date, 0.0) + c
    return [
        {"date": d, "cost": round(v, 6)}
        for d, v in sorted(totals.items())
    ]


def _spend_by_model(session: Session, days: int | None) -> list[dict]:
    """Total derived cost per model. Python-side sum: SQL SUM would silently
    drop NULL-cost rows from unpriced models, undercounting entries."""
    totals: dict[int | None, dict] = {}
    for model_id, explicit, in_tok, out_tok, p_in, p_out in _spend_rows(session, days):
        c = _entry_cost(explicit, in_tok, out_tok, p_in, p_out)
        bucket = totals.setdefault(model_id, {"cost": 0.0, "entries": 0})
        bucket["entries"] += 1
        if c is not None:
            bucket["cost"] += c

    model_map = _load_models(session, [m for m in totals if m is not None])
    result = []
    for model_id, bucket in sorted(
        totals.items(), key=lambda kv: kv[1]["cost"], reverse=True
    ):
        m = model_map.get(model_id)
        result.append({
            "model_id": model_id,
            "model_name": m.name if m else "Unknown",
            "total_cost": round(bucket["cost"], 6),
            "entries": bucket["entries"],
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


@router.get("/monthly")
def monthly(
    month: str = Query(description="Month to summarize, as YYYY-MM"),
    session: Session = Depends(get_session),
):
    """One row per model for the given month: entries, tokens, spend, quality.

    Cost follows the standard precedence (explicit > token-derived); entries
    whose cost is unknown are counted under `unknown_cost_entries` so the
    month's total is not silently read as complete.
    """
    try:
        month_start = datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(422, f"month must be YYYY-MM, got {month!r}")
    # Next month boundary; naive UTC matches created_at storage.
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    rows = session.exec(
        select(
            LogEntry.model_id,
            func.count(LogEntry.id).label("entries"),
            func.sum(LogEntry.input_tokens).label("input_tokens"),
            func.sum(LogEntry.output_tokens).label("output_tokens"),
            func.avg(LogEntry.quality_score).label("avg_quality"),
        )
        .select_from(LogEntry)
        .outerjoin(Model, LogEntry.model_id == Model.id)
        .where(LogEntry.created_at >= month_start, LogEntry.created_at < month_end)
        .group_by(LogEntry.model_id)
    ).all()

    model_map = _load_models(session, [r[0] for r in rows])
    result = []
    total_cost = 0.0
    unknown_entries = 0
    for model_id, entries, in_tok, out_tok, avg_q in rows:
        m = model_map.get(model_id)
        name = m.name if m else "Unknown"
        # Python-side cost sum: SQL SUM would drop NULL-cost rows entirely.
        cost = 0.0
        unknown = 0
        scan = session.exec(
            select(
                LogEntry.cost_usd,
                LogEntry.input_tokens,
                LogEntry.output_tokens,
                Model.input_price_per_mtok,
                Model.output_price_per_mtok,
            )
            .select_from(LogEntry)
            .outerjoin(Model, LogEntry.model_id == Model.id)
            .where(
                LogEntry.created_at >= month_start,
                LogEntry.created_at < month_end,
                LogEntry.model_id == model_id if model_id is not None else LogEntry.model_id.is_(None),
            )
        ).all()
        for explicit, it, ot, pin, pout in scan:
            c = (
                float(explicit) if explicit is not None
                else (it / 1e6 * pin + ot / 1e6 * pout) if None not in (it, ot, pin, pout)
                else None
            )
            if c is None:
                unknown += 1
            else:
                cost += c

        total_cost += cost
        unknown_entries += unknown
        result.append({
            "model_id": model_id,
            "model_name": name,
            "entries": entries,
            "input_tokens": int(in_tok or 0),
            "output_tokens": int(out_tok or 0),
            "total_cost": round(cost, 6),
            "avg_quality": round(avg_q, 2) if avg_q is not None else None,
            "unknown_cost_entries": unknown,
        })

    return {
        "month": month,
        "total_cost": round(total_cost, 6),
        "unknown_cost_entries": unknown_entries,
        "by_model": sorted(result, key=lambda r: r["total_cost"], reverse=True),
    }
