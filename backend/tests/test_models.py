"""Tests for model CRUD — duplicate-name handling and basic create/update/delete."""


def test_create_model_duplicate_name_returns_409(client):
    client.post("/api/models", json={"name": "DupeModel", "kind": "web"})
    resp = client.post("/api/models", json={"name": "DupeModel", "kind": "local"})
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


def test_create_model_basic(client):
    resp = client.post("/api/models", json={"name": "SoloModel", "kind": "web", "vendor": "Acme"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "SoloModel"
    assert data["vendor"] == "Acme"
    assert data["is_active"] is True
    assert data["id"] is not None


def test_list_models_active_only(client):
    client.post("/api/models", json={"name": "ActiveOne", "kind": "web"})
    client.post("/api/models", json={"name": "InactiveOne", "kind": "web"})
    created = client.post("/api/models", json={"name": "InactiveTwo", "kind": "web"}).json()
    client.patch(f"/api/models/{created['id']}", json={"is_active": False})

    all_models = client.get("/api/models").json()
    assert len(all_models) >= 3
    active = client.get("/api/models?active_only=true").json()
    assert all(m["is_active"] for m in active)
    assert all(m["name"] != "InactiveTwo" for m in active)


def test_update_model_rename_to_existing_returns_409(client):
    a = client.post("/api/models", json={"name": "RenameKeep", "kind": "web"}).json()
    client.post("/api/models", json={"name": "RenameTarget", "kind": "web"})
    resp = client.patch(f"/api/models/{a['id']}", json={"name": "RenameTarget"})
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


def test_update_model_not_found(client):
    resp = client.patch("/api/models/99999", json={"name": "Nope"})
    assert resp.status_code == 404


def test_update_model_max_length_enforced(client):
    m = client.post("/api/models", json={"name": "LenModel", "kind": "web"}).json()
    resp = client.patch(f"/api/models/{m['id']}", json={"name": "x" * 200})
    assert resp.status_code == 422


def test_delete_model(client):
    m = client.post("/api/models", json={"name": "ToDelete", "kind": "web"}).json()
    resp = client.delete(f"/api/models/{m['id']}")
    assert resp.status_code == 204
    remaining = client.get("/api/models").json()
    assert all(x["name"] != "ToDelete" for x in remaining)
    # Deleting again should 404.
    assert client.delete(f"/api/models/{m['id']}").status_code == 404


def test_delete_model_not_found(client):
    assert client.delete("/api/models/99999").status_code == 404
