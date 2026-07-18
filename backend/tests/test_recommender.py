"""Tests for the recommender endpoint — Bayesian shrinkage logic."""


def test_recommend_global_empty(client):
    resp = client.get("/api/recommend")
    assert resp.status_code == 200
    data = resp.json()
    assert data["category_id"] is None
    assert data["category_name"] is None
    assert data["recommendations"] == []
    assert data["global_avg_quality"] == 5.0  # default when no data


def test_recommend_returns_ranked_models(client):
    model_a = client.post("/api/models", json={"name": "RankA", "kind": "web"}).json()
    model_b = client.post("/api/models", json={"name": "RankB", "kind": "web"}).json()
    cat = client.post("/api/categories", json={"name": "RankCat"}).json()

    # Model A: high quality, many entries
    for _ in range(10):
        client.post("/api/logs", json={"model_id": model_a["id"], "category_id": cat["id"], "quality_score": 9, "outcome": "solved"})

    # Model B: lower quality, fewer entries
    for _ in range(2):
        client.post("/api/logs", json={"model_id": model_b["id"], "category_id": cat["id"], "quality_score": 6, "outcome": "partial"})

    resp = client.get("/api/recommend")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["recommendations"]) == 2

    # Model A should rank higher
    assert data["recommendations"][0]["model"]["name"] == "RankA"
    assert data["recommendations"][0]["score"] > data["recommendations"][1]["score"]


def test_recommend_bayesian_shrinkage(client):
    """Verify shrinkage: a model with few entries has its score pulled toward the global average,
    while a model with many entries stays closer to its raw average."""
    model_few = client.post("/api/models", json={"name": "FewEntries", "kind": "web"}).json()
    model_many = client.post("/api/models", json={"name": "ManyEntries", "kind": "web"}).json()
    cat = client.post("/api/categories", json={"name": "ShrinkCat"}).json()

    # Model with 1 entry at quality 10
    client.post("/api/logs", json={"model_id": model_few["id"], "category_id": cat["id"], "quality_score": 10, "outcome": "solved"})

    # Model with 10 entries at quality 8
    for _ in range(10):
        client.post("/api/logs", json={"model_id": model_many["id"], "category_id": cat["id"], "quality_score": 8, "outcome": "solved"})

    resp = client.get("/api/recommend")
    data = resp.json()
    recs = data["recommendations"]

    few = next(r for r in recs if r["model"]["name"] == "FewEntries")
    many = next(r for r in recs if r["model"]["name"] == "ManyEntries")

    # Global avg should be between 8 and 10
    global_avg = data["global_avg_quality"]
    assert 8.0 <= global_avg <= 10.0

    # FewEntries: raw avg=10, shrunk score should be between global_avg and 10 (pulled down)
    assert global_avg < few["score"] < 10.0

    # ManyEntries: raw avg=8, shrunk score should be between 8.0 and global_avg (pulled up toward global)
    assert 8.0 <= many["score"] <= global_avg + 0.01

    # The shrinkage distance (|raw_avg - score|) should be larger for the few-entries model
    few_shrinkage = abs(10.0 - few["score"])
    many_shrinkage = abs(8.0 - many["score"])
    assert few_shrinkage > many_shrinkage, "Model with fewer entries should have more shrinkage"


def test_recommend_by_category(client):
    model = client.post("/api/models", json={"name": "CatModel", "kind": "web"}).json()
    cat_a = client.post("/api/categories", json={"name": "CatA"}).json()
    cat_b = client.post("/api/categories", json={"name": "CatB"}).json()

    client.post("/api/logs", json={"model_id": model["id"], "category_id": cat_a["id"], "quality_score": 9})
    client.post("/api/logs", json={"model_id": model["id"], "category_id": cat_b["id"], "quality_score": 5})

    resp = client.get(f"/api/recommend?category_id={cat_a['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["category_name"] == "CatA"
    assert len(data["recommendations"]) == 1
    assert data["recommendations"][0]["avg_quality"] == 9.0


def test_recommend_top_n(client):
    for i in range(5):
        m = client.post("/api/models", json={"name": f"TopN{i}", "kind": "web"}).json()
        client.post("/api/logs", json={"model_id": m["id"], "quality_score": 7 + i})

    resp = client.get("/api/recommend?top_n=3")
    data = resp.json()
    assert len(data["recommendations"]) == 3
