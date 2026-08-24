"""Tests for the daily budget check (backend.budget)."""
from datetime import datetime, timedelta

from backend.budget import check_budget, set_setting, todays_spend
from backend.models import LogEntry


def _set_budget(session, usd: str | None):
    set_setting(session, "daily_budget_usd", usd or "")
    session.commit()


def test_no_budget_configured_returns_none(client, session):
    assert check_budget(session) is None


def test_invalid_budget_value_is_ignored(client, session):
    _set_budget(session, "not-a-number")
    session.add(LogEntry(cost_usd=999.0))
    session.commit()
    assert check_budget(session) is None


def test_zero_or_negative_budget_disables_check(client, session):
    _set_budget(session, "0")
    session.add(LogEntry(cost_usd=50.0))
    session.commit()
    assert check_budget(session) is None


def test_under_budget_returns_none(client, session):
    _set_budget(session, "1.00")
    session.add(LogEntry(cost_usd=0.50))
    session.commit()
    assert check_budget(session) is None


def test_crossing_budget_fires_event_once_per_day(client, session):
    _set_budget(session, "1.00")
    session.add(LogEntry(cost_usd=0.75))
    session.commit()

    assert check_budget(session) is None  # 0.75 < 1.00 — under

    session.add(LogEntry(cost_usd=0.50))  # total 1.25 -> crosses
    session.commit()
    event = check_budget(session)
    assert event is not None
    assert event["type"] == "daily_budget_exceeded"
    assert event["budget_usd"] == 1.00
    assert abs(event["spent_usd"] - 1.25) < 1e-9
    assert abs(event["over_by_usd"] - 0.25) < 1e-9

    # Second evaluation same day: already warned -> None.
    session.add(LogEntry(cost_usd=5.0))
    session.commit()
    assert check_budget(session) is None


def test_derived_tokens_count_toward_budget(client, session):
    priced = client.post("/api/models", json={
        "name": "Priced", "kind": "web",
        "input_price_per_mtok": 0.15,
        "output_price_per_mtok": 0.60,
    }).json()
    # 2M in * 0.15 + 0.5M out * 0.60 = 0.30 + 0.30 = 0.60
    session.add(LogEntry(
        model_id=priced["id"], input_tokens=2_000_000, output_tokens=500_000,
    ))
    session.commit()
    _set_budget(session, "0.50")  # 0.60 > 0.50 -> crosses

    event = check_budget(session)
    assert event is not None
    assert abs(event["spent_usd"] - 0.60) < 1e-9


def test_unknown_cost_reported_but_not_counted(client, session):
    unpriced = client.post("/api/models", json={"name": "FreeM", "kind": "web"}).json()
    session.add(LogEntry(  # unknown cost (no prices)
        model_id=unpriced["id"], input_tokens=10_000_000, output_tokens=10_000_000,
    ))
    session.commit()
    _set_budget(session, "1.00")

    assert check_budget(session) is None  # known spend 0.00 — under budget

    session.add(LogEntry(cost_usd=1.20))  # now cross via explicit cost
    session.commit()
    event = check_budget(session)
    assert event is not None
    assert "unknown cost" in event["body"]


def test_warned_on_flag_resets_next_day(client, session):
    """Simulate yesterday's warning: warned_on=yesterday must allow firing today."""
    from backend.budget import WARNED_ON_KEY, get_setting

    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    set_setting(session, WARNED_ON_KEY, yesterday)
    _set_budget(session, "1.00")
    session.add(LogEntry(cost_usd=2.0))
    session.commit()

    event = check_budget(session)
    assert event is not None
    today = datetime.utcnow().strftime("%Y-%m-%d")
    assert get_setting(session, WARNED_ON_KEY) == today


def test_todays_spend_excludes_yesterday(client, session):
    yesterday = datetime.utcnow().replace(tzinfo=None) - timedelta(days=1)
    session.add(LogEntry(cost_usd=77.0, created_at=yesterday))
    session.add(LogEntry(cost_usd=0.25))  # today
    session.commit()

    spent, unknown = todays_spend(session)
    assert abs(spent - 0.25) < 1e-9
    assert unknown == 0
