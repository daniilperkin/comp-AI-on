"""Daily budget checking.

Fires once per UTC day when cumulative derived spend crosses the configured
budget. Uses the same cost precedence as the spend analytics (explicit >
token-derived > unknown). Unknown-cost entries never count toward the total
but are reported so a "you're at $0.00" message can't mislead.
"""
import logging
from datetime import datetime, timedelta

from sqlmodel import Session, select

from backend.models import LogEntry, Model, Setting

logger = logging.getLogger(__name__)

BUDGET_KEY = "daily_budget_usd"
WARNED_ON_KEY = "daily_budget_warned_on"


def get_setting(session: Session, key: str, default: str = "") -> str:
    row = session.get(Setting, key)
    return row.value if row is not None and row.value is not None else default


def set_setting(session: Session, key: str, value: str) -> None:
    row = session.get(Setting, key)
    if row is None:
        row = Setting(key=key, value=value)
    else:
        row.value = value
    session.add(row)


def todays_spend(session: Session) -> tuple[float, int]:
    """(summed known cost today, count of entries whose cost is unknown).

    Python-side sum again: SQL SUM would drop NULL-cost rows, hiding how much
    of today's usage has unaccounted spend.
    """
    midnight = _utc_midnight()
    stmt = (
        select(
            LogEntry.cost_usd,
            LogEntry.input_tokens,
            LogEntry.output_tokens,
            Model.input_price_per_mtok,
            Model.output_price_per_mtok,
        )
        .select_from(LogEntry)
        .outerjoin(Model, LogEntry.model_id == Model.id)
        .where(LogEntry.created_at >= midnight)
    )

    total = 0.0
    unknown = 0
    for explicit, in_tok, out_tok, p_in, p_out in session.exec(stmt).all():
        if explicit is not None:
            total += float(explicit)
        elif None not in (in_tok, out_tok, p_in, p_out):
            total += in_tok / 1_000_000 * p_in + out_tok / 1_000_000 * p_out
        else:
            unknown += 1
    return total, unknown


def _utc_midnight() -> datetime:
    now = datetime.utcnow()
    return now - timedelta(
        hours=now.hour, minutes=now.minute, seconds=now.second,
        microseconds=now.microsecond,
    )


def check_budget(session: Session) -> dict | None:
    """Evaluate the daily budget. Returns an event dict when the budget was
    crossed TODAY and no warning has been sent yet; None otherwise.

    Side effects on crossing: writes daily_budget_warned_on = today so the
    warning fires at most once per day regardless of how many entries follow.
    """
    raw = get_setting(session, BUDGET_KEY)
    if not raw:
        return None
    try:
        budget = float(raw)
    except ValueError:
        logger.warning("invalid %s=%r — ignoring", BUDGET_KEY, raw)
        return None
    if budget <= 0:
        return None

    today = datetime.utcnow().strftime("%Y-%m-%d")
    if get_setting(session, WARNED_ON_KEY) == today:
        return None  # already warned today

    spent, unknown_count = todays_spend(session)
    if spent < budget:
        return None

    set_setting(session, WARNED_ON_KEY, today)
    session.commit()

    over_by = round(spent - budget, 6)
    note = ""
    if unknown_count:
        note = f" ({unknown_count} entr{'y' if unknown_count == 1 else 'ies'} with unknown cost not counted)"
    return {
        "type": "daily_budget_exceeded",
        "budget_usd": budget,
        "spent_usd": round(spent, 6),
        "over_by_usd": over_by,
        "title": "Daily budget exceeded",
        "body": (
            f"Today's spend is ${round(spent, 4):g} against a ${budget:g} "
            f"budget (${over_by:g} over).{note}"
        ),
    }
