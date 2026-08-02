"""Tests for category CRUD — duplicate-name handling and basic operations."""


def test_create_category_duplicate_name_returns_409(client):
    client.post("/api/categories", json={"name": "DupeCat"})
    resp = client.post("/api/categories", json={"name": "DupeCat"})
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


def test_create_category_basic(client):
    resp = client.post("/api/categories", json={"name": "FreshCat", "color": "#ff0000"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "FreshCat"
    assert data["color"] == "#ff0000"
    assert data["id"] is not None


def test_list_categories(client):
    client.post("/api/categories", json={"name": "ListCatA"})
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert "ListCatA" in names


def test_update_category_rename_to_existing_returns_409(client):
    a = client.post("/api/categories", json={"name": "RenameKeep"}).json()
    client.post("/api/categories", json={"name": "RenameTarget"})
    resp = client.patch(f"/api/categories/{a['id']}", json={"name": "RenameTarget"})
    assert resp.status_code == 409


def test_update_category_not_found(client):
    resp = client.patch("/api/categories/99999", json={"name": "Nope"})
    assert resp.status_code == 404


def test_update_category_color_max_length(client):
    c = client.post("/api/categories", json={"name": "ColorCat"}).json()
    resp = client.patch(f"/api/categories/{c['id']}", json={"color": "x" * 100})
    assert resp.status_code == 422


def test_delete_category(client):
    c = client.post("/api/categories", json={"name": "DeleteCat"}).json()
    resp = client.delete(f"/api/categories/{c['id']}")
    assert resp.status_code == 204
    remaining = client.get("/api/categories").json()
    assert all(x["name"] != "DeleteCat" for x in remaining)


def test_delete_category_not_found(client):
    assert client.delete("/api/categories/99999").status_code == 404
