"""Tests for export filters and the monthly summary endpoint."""
import json
from datetime import date, datetime, timedelta, timezone

from backend.models import LogEntry


def _make_priced_model(client, name="Priced", pin=0.15, pout=0.60):
    return client.post("/api/models", json={
        "name": name,
        "kind": "web",
        "input_price_per_mtok": pin,
        "output_price_per_mtok": pout,
    }).json()


def _add_old_entry(session, model_id: int, cost: float, days_ago: int) -> None:
    """Insert an entry dated N days ago via the fixture session (same in-memory
    engine the API client uses — a module-level engine import would point at
    the real database.db instead)."""
    session.add(LogEntry(
        model_id=model_id,
        cost_usd=cost,
        created_at=datetime.utcnow() - timedelta(days=days_ago),
    ))
    session.commit()


# ---------------------------------------------------------------------------
# Export filters + derived_cost_usd column
# ---------------------------------------------------------------------------

def test_export_csv_honors_date_filters(client, session):
    model = _make_priced_model(client)
    client.post("/api/logs", json={"model_id": model["id"], "cost_usd": 0.30})
    _add_old_entry(session, model["id"], 99.0, days_ago=60)

    all_rows = client.get("/api/logs/export/csv").text.strip().splitlines()
    assert len(all_rows) == 3  # header + 2 entries

    # A window covering only today excludes the 60-day-old entry.
    today = date.today().isoformat()
    recent = client.get(f"/api/logs/export/csv?date_from={today}&date_to={today}").text
    assert "99.0" not in recent
    assert "0.3" in recent


def test_export_json_includes_derived_cost(client):
    model = _make_priced_model(client)
    # Derived: 1M * 0.15 + 100k * 0.60 = 0.21; explicit cost absent.
    client.post("/api/logs", json={
        "model_id": model["id"],
        "input_tokens": 1_000_000,
        "output_tokens": 100_000,
    })
    # Explicit cost present: derived mirrors it.
    client.post("/api/logs", json={"model_id": model["id"], "cost_usd": 0.05})

    rows = json.loads(client.get("/api/logs/export/json").text)
    derived = sorted(r["derived_cost_usd"] for r in rows)
    assert derived == [0.05, 0.21]


def test_export_invalid_date_returns_422(client):
    resp = client.get("/api/logs/export/csv?date_from=not-a-date")
    assert resp.status_code == 422


def test_export_model_filter_still_works_with_dates(client):
    a = _make_priced_model(client, name="A")
    b = client.post("/api/models", json={
        "name": "B", "kind": "web",
        "input_price_per_mtok": 1.0, "output_price_per_mtok": 1.0,
    }).json()
    client.post("/api/logs", json={"model_id": a["id"], "cost_usd": 0.10})
    client.post("/api/logs", json={"model_id": b["id"], "cost_usd": 0.20})

    rows = json.loads(client.get(f"/api/logs/export/json?model_id={a['id']}").text)
    assert len(rows) == 1
    assert rows[0]["model"] == "A"


# ---------------------------------------------------------------------------
# Monthly summary
# ---------------------------------------------------------------------------

def test_monthly_aggregates_by_model(client, session):
    priced = _make_priced_model(client)
    plain = client.post("/api/models", json={"name": "Plain", "kind": "web"}).json()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    session.add(LogEntry(  # derived: 2M*0.15 + 0.5M*0.60 = 0.60
        model_id=priced["id"], input_tokens=2_000_000, output_tokens=500_000,
        created_at=now,
    ))
    session.add(LogEntry(model_id=plain["id"], cost_usd=0.10, created_at=now))
    # Last month's entry must not leak into this month's summary.
    session.add(LogEntry(
        model_id=priced["id"], cost_usd=42.0,
        created_at=(now.replace(day=1) - timedelta(days=1)),
    ))
    session.commit()

    month = now.strftime("%Y-%m")
    data = json.loads(client.get(f"/api/stats/monthly?month={month}").text)
    assert data["month"] == month
    assert abs(data["total_cost"] - 0.70) < 1e-9
    by_name = {r["model_name"]: r for r in data["by_model"]}
    assert abs(by_name["Priced"]["total_cost"] - 0.60) < 1e-9
    assert by_name["Priced"]["entries"] == 1
    assert by_name["Priced"]["input_tokens"] == 2_000_000
    assert abs(by_name["Plain"]["total_cost"] - 0.10) < 1e-9


def test_monthly_counts_unknown_cost_entries(client, session):
    model = client.post("/api/models", json={"name": "FreeModel", "kind": "web"}).json()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    session.add(LogEntry(
        model_id=model["id"],
        input_tokens=999_999, output_tokens=999_999,
        created_at=now,  # no prices configured -> cost unknown
    ))
    session.commit()

    data = json.loads(
        client.get(f"/api/stats/monthly?month={now.strftime('%Y-%m')}").text
    )
    assert data["by_model"][0]["unknown_cost_entries"] == 1
    assert data["by_model"][0]["total_cost"] == 0.0
    assert data["unknown_cost_entries"] == 1


def test_monthly_invalid_month_returns_422(client):
    resp = client.get("/api/stats/monthly?month=2026/13")
    assert resp.status_code == 422
