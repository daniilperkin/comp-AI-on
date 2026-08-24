"""Tests for stats endpoints — overview, leaderboard, matrix, timeline."""


def test_stats_overview_empty(client):
    resp = client.get("/api/stats/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_entries"] == 0
    assert data["avg_quality"] is None
    assert data["success_rate"] is None
    assert data["last_7_days"] == 0
    assert data["total_cost_30d"] == 0.0
    assert data["total_cost_all_time"] == 0.0
    assert data["top_models"] == []


def test_stats_overview_with_entries(client):
    # Create a model and some entries
    model = client.post("/api/models", json={"name": "TestModel", "kind": "web"}).json()
    cat = client.post("/api/categories", json={"name": "TestCat"}).json()

    for score in [8, 9, 7]:
        client.post("/api/logs", json={
            "model_id": model["id"],
            "category_id": cat["id"],
            "quality_score": score,
            "outcome": "solved",
        })

    resp = client.get("/api/stats/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_entries"] == 3
    assert data["avg_quality"] == 8.0
    assert data["success_rate"] == 1.0
    assert len(data["top_models"]) == 1
    assert data["top_models"][0]["model"]["name"] == "TestModel"
    assert data["top_models"][0]["entries"] == 3


def test_stats_leaderboard(client):
    model_a = client.post("/api/models", json={"name": "ModelA", "kind": "web"}).json()
    model_b = client.post("/api/models", json={"name": "ModelB", "kind": "web"}).json()
    cat = client.post("/api/categories", json={"name": "TestCat"}).json()

    client.post("/api/logs", json={"model_id": model_a["id"], "category_id": cat["id"], "quality_score": 9, "outcome": "solved"})
    client.post("/api/logs", json={"model_id": model_a["id"], "category_id": cat["id"], "quality_score": 8, "outcome": "partial"})
    client.post("/api/logs", json={"model_id": model_b["id"], "category_id": cat["id"], "quality_score": 5, "outcome": "failed"})

    resp = client.get("/api/stats/leaderboard")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["model"]["name"] == "ModelA"
    assert data[0]["avg_quality"] == 8.5
    assert data[0]["entries"] == 2
    assert data[0]["success_rate"] == 0.5


def test_stats_matrix(client):
    model = client.post("/api/models", json={"name": "MatrixModel", "kind": "web"}).json()
    cat = client.post("/api/categories", json={"name": "MatrixCat"}).json()

    client.post("/api/logs", json={"model_id": model["id"], "category_id": cat["id"], "quality_score": 7})

    resp = client.get("/api/stats/matrix")
    assert resp.status_code == 200
    data = resp.json()
    assert any(m["name"] == "MatrixModel" for m in data["models"])
    assert any(c["name"] == "MatrixCat" for c in data["categories"])
    cell = next(c for c in data["cells"] if c["model_name"] == "MatrixModel")
    assert cell["avg_quality"] == 7.0
    assert cell["entries"] == 1


def test_stats_timeline(client):
    model = client.post("/api/models", json={"name": "TimelineModel", "kind": "web"}).json()
    client.post("/api/logs", json={"model_id": model["id"], "quality_score": 8})

    resp = client.get("/api/stats/timeline")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "date" in data[0]
    assert data[0]["count"] == 1


# ---------------------------------------------------------------------------
# Spend analytics (explicit cost > token-derived > unknown)
# ---------------------------------------------------------------------------

def _make_priced_model(client, name="Priced", pin=0.15, pout=0.60):
    return client.post("/api/models", json={
        "name": name,
        "kind": "web",
        "input_price_per_mtok": pin,
        "output_price_per_mtok": pout,
    }).json()


def test_spend_derives_cost_from_priced_model(client):
    model = _make_priced_model(client)
    # 1M in * 0.15 + 100k out * 0.60 = 0.21
    client.post("/api/logs", json={
        "model_id": model["id"],
        "input_tokens": 1_000_000,
        "output_tokens": 100_000,
    })

    resp = client.get("/api/stats/spend")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["daily"]) == 1
    assert data["daily"][0]["cost"] == 0.21
    assert data["by_model"][0]["model_name"] == "Priced"
    assert data["by_model"][0]["total_cost"] == 0.21


def test_spend_explicit_cost_wins_over_derived(client):
    model = _make_priced_model(client)
    client.post("/api/logs", json={
        "model_id": model["id"],
        "input_tokens": 1_000_000,
        "output_tokens": 100_000,
        "cost_usd": 0.05,  # disagrees with derived 0.21 on purpose
    })
    data = client.get("/api/stats/spend").json()
    assert data["daily"][0]["cost"] == 0.05


def test_spend_unpriced_model_contributes_zero_but_is_visible(client):
    model = client.post("/api/models", json={"name": "Free", "kind": "web"}).json()
    client.post("/api/logs", json={
        "model_id": model["id"],
        "input_tokens": 5_000_000,
        "output_tokens": 500_000,
    })
    data = client.get("/api/stats/spend").json()
    # No prices configured -> cost unknown -> not summed...
    assert sum(d["cost"] for d in data["daily"]) == 0.0
    # ...but the model still appears so spend isn't silently undercounted.
    assert len(data["by_model"]) == 1


def test_overview_and_leaderboard_carry_cost_fields(client):
    priced = _make_priced_model(client)
    plain = client.post("/api/models", json={"name": "Plain", "kind": "web"}).json()

    client.post("/api/logs", json={  # derived: 2M*0.15 + 0.5M*0.60 = 0.60
        "model_id": priced["id"], "input_tokens": 2_000_000, "output_tokens": 500_000,
    })
    client.post("/api/logs", json={"model_id": plain["id"], "cost_usd": 0.10})

    overview = client.get("/api/stats/overview").json()
    assert abs(overview["total_cost_all_time"] - 0.70) < 1e-9
    assert abs(overview["total_cost_30d"] - 0.70) < 1e-9

    board = {row["model"]["name"]: row for row in client.get("/api/stats/leaderboard").json()}
    assert abs(board["Priced"]["total_cost"] - 0.60) < 1e-9
    assert abs(board["Plain"]["total_cost"] - 0.10) < 1e-9


def test_spend_days_filter_excludes_old_entries(client):
    from datetime import datetime, timedelta

    from sqlmodel import Session

    from backend.db import engine
    from backend.models import LogEntry

    model = _make_priced_model(client)
    client.post("/api/logs", json={"model_id": model["id"], "cost_usd": 0.30})

    old_entry = LogEntry(
        model_id=model["id"], cost_usd=99.0,
        created_at=datetime.utcnow() - timedelta(days=60),
    )
    with Session(engine) as session:
        session.add(old_entry)
        session.commit()

    all_time = client.get("/api/stats/spend").json()
    assert sum(d["cost"] for d in all_time["daily"]) == 99.30

    recent = client.get("/api/stats/spend?days=7").json()
    assert sum(d["cost"] for d in recent["daily"]) == 0.30
