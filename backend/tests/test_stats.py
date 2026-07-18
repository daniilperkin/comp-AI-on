"""Tests for stats endpoints — overview, leaderboard, matrix, timeline."""


def test_stats_overview_empty(client):
    resp = client.get("/api/stats/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_entries"] == 0
    assert data["avg_quality"] is None
    assert data["success_rate"] is None
    assert data["last_7_days"] == 0
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
