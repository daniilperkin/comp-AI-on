"""Tests for log entry CRUD, validation, and export endpoints."""

from datetime import UTC, datetime, timedelta


def test_create_log_requires_content(client):
    resp = client.post("/api/logs", json={})
    assert resp.status_code == 400
    assert "at least" in resp.json()["detail"].lower()


def test_create_log_with_model_only(client):
    model = client.post("/api/models", json={"name": "TestModel", "kind": "web"}).json()
    resp = client.post("/api/logs", json={"model_id": model["id"]})
    assert resp.status_code == 201
    data = resp.json()
    assert data["model_id"] == model["id"]
    assert data["id"] is not None


def test_create_log_with_description_only(client):
    resp = client.post("/api/logs", json={"task_description": "Testing the model"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["task_description"] == "Testing the model"
    assert data["model_id"] is None


def test_list_logs_pagination_header(client):
    model = client.post("/api/models", json={"name": "PagModel", "kind": "web"}).json()
    for _ in range(3):
        client.post("/api/logs", json={"model_id": model["id"]})

    resp = client.get("/api/logs?limit=2")
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    assert resp.headers["x-total-count"] == "3"
    assert resp.headers["x-limit"] == "2"


def test_list_logs_filter_by_model(client):
    model_a = client.post("/api/models", json={"name": "FilterA", "kind": "web"}).json()
    model_b = client.post("/api/models", json={"name": "FilterB", "kind": "web"}).json()
    client.post("/api/logs", json={"model_id": model_a["id"]})
    client.post("/api/logs", json={"model_id": model_b["id"]})

    resp = client.get(f"/api/logs?model_id={model_a['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["model_id"] == model_a["id"]


def test_list_logs_unrated_filter(client):
    client.post("/api/logs", json={"task_description": "scored", "quality_score": 8})
    client.post("/api/logs", json={"task_description": "unscored"})

    resp = client.get("/api/logs?unrated=true")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["task_description"] == "unscored"
    assert resp.headers["x-total-count"] == "1"


def test_list_logs_origin_filter(client, session):
    from backend.models import LogEntry

    client.post("/api/logs", json={"task_description": "manual one"})
    session.add(LogEntry(task_description="hermes one", origin="hermes"))
    session.commit()

    resp = client.get("/api/logs?origin=hermes")
    assert resp.status_code == 200
    data = resp.json()
    assert [d["task_description"] for d in data] == ["hermes one"]


def test_list_logs_search_filter(client):
    client.post("/api/logs", json={"task_description": "refactor the parser"})
    client.post("/api/logs", json={"task_description": "write release notes"})

    resp = client.get("/api/logs?q=parser")
    assert resp.status_code == 200
    assert [d["task_description"] for d in resp.json()] == ["refactor the parser"]
    assert resp.headers["x-total-count"] == "1"

    # No match is an empty page, not an error.
    assert client.get("/api/logs?q=nothing-matches").json() == []


def test_list_logs_search_matches_session_title(client, session):
    from backend.models import LogEntry

    session.add(LogEntry(task_description="auto-imported", session_title="Fix the parser"))
    session.add(LogEntry(task_description="auto-imported", session_title="Write docs"))
    session.commit()

    resp = client.get("/api/logs?q=parser")
    assert [d["session_title"] for d in resp.json()] == ["Fix the parser"]


def test_list_logs_date_range_filter(client):
    client.post("/api/logs", json={"task_description": "recent"})

    # Everything created "now" matches today, and nothing matches tomorrow.
    today = datetime.now(UTC).date().isoformat()
    tomorrow = (datetime.now(UTC).date() + timedelta(days=1)).isoformat()

    assert client.get(f"/api/logs?date_from={today}").json()
    assert client.get(f"/api/logs?date_from={tomorrow}").json() == []
    # Malformed dates are a client error, not a 500.
    assert client.get("/api/logs?date_from=20-10-2026").status_code == 422


def test_get_single_log(client):
    model = client.post("/api/models", json={"name": "SingleModel", "kind": "web"}).json()
    created = client.post("/api/logs", json={"model_id": model["id"], "quality_score": 7}).json()

    resp = client.get(f"/api/logs/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["quality_score"] == 7


def test_get_log_not_found(client):
    resp = client.get("/api/logs/99999")
    assert resp.status_code == 404


def test_update_log(client):
    model = client.post("/api/models", json={"name": "UpdateModel", "kind": "web"}).json()
    created = client.post("/api/logs", json={"model_id": model["id"], "quality_score": 5}).json()

    resp = client.patch(f"/api/logs/{created['id']}", json={"quality_score": 9})
    assert resp.status_code == 200
    assert resp.json()["quality_score"] == 9


def test_delete_log(client):
    model = client.post("/api/models", json={"name": "DeleteModel", "kind": "web"}).json()
    created = client.post("/api/logs", json={"model_id": model["id"]}).json()

    resp = client.delete(f"/api/logs/{created['id']}")
    assert resp.status_code == 204

    resp = client.get(f"/api/logs/{created['id']}")
    assert resp.status_code == 404


def test_export_csv(client):
    model = client.post("/api/models", json={"name": "ExportModel", "kind": "web"}).json()
    client.post("/api/logs", json={"model_id": model["id"], "quality_score": 8})

    resp = client.get("/api/logs/export/csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().split("\n")
    assert "model" in lines[0]
    assert len(lines) >= 2


def test_export_json(client):
    model = client.post("/api/models", json={"name": "JsonExportModel", "kind": "web"}).json()
    client.post("/api/logs", json={"model_id": model["id"], "quality_score": 8})

    resp = client.get("/api/logs/export/json")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["model"] == "JsonExportModel"


def test_quality_score_validation(client):
    resp = client.post("/api/logs", json={"task_description": "test", "quality_score": 15})
    assert resp.status_code == 422

    resp = client.post("/api/logs", json={"task_description": "test", "quality_score": 0})
    assert resp.status_code == 422
