"""Tests for the Firebase mirror (Firestore push payloads)."""
import pytest

from backend import firebase_mirror
from backend.models import Category, LogEntry, Model, Setting


@pytest.fixture(autouse=True)
def _schema(engine):
    """Session-only tests need the schema created explicitly."""
    from backend.db import init_db

    init_db()


def _seed(session):
    model = Model(name="MirrorModel", kind="web", vendor="TestVendor", is_active=True)
    category = Category(name="MirrorCat", color="#fff")
    session.add(model)
    session.add(category)
    session.commit()
    session.refresh(model)
    session.refresh(category)
    session.add(
        LogEntry(
            model_id=model.id,
            category_id=category.id,
            quality_score=8,
            outcome="solved",
            cost_usd=0.5,
            origin="manual",
        )
    )
    reminder = session.get(Setting, "reminder_time") or Setting(key="reminder_time")
    reminder.value = "18:00"
    session.add(reminder)
    session.add(Setting(key="openrouter_api_key", value="sk-test-never-leaves"))
    session.commit()


def test_collect_documents_payload(session):
    _seed(session)
    docs = firebase_mirror.collect_documents(session)

    assert set(docs) == {"models", "categories", "logs", "settings", "meta"}
    assert len(docs["logs"]) == 1
    log_doc = next(iter(docs["logs"].values()))
    assert log_doc["quality_score"] == 8
    assert isinstance(log_doc["created_at"], str)
    assert docs["settings"]["reminder_time"] == {"value": "18:00"}
    assert "openrouter_api_key" not in docs["settings"]
    assert docs["meta"]["state"]["counts"]["logs"] == 1
    for key in ("overview", "timeline", "leaderboard", "matrix", "spend", "monthly"):
        assert key in docs["meta"]


class _FakeDoc:
    def __init__(self, path, sink):
        self.path = path
        self.sink = sink

    def set(self, data):
        self.sink.append((self.path[0], self.path[1], data))


class _FakeCollection:
    def __init__(self, name, sink):
        self.name = name
        self.sink = sink

    def document(self, doc_id):
        return _FakeDoc((self.name, doc_id), self.sink)


class _FakeBatch:
    def set(self, doc, data):
        doc.set(data)

    def commit(self):
        pass


class FakeClient:
    def __init__(self):
        self.writes = []

    def collection(self, name):
        return _FakeCollection(name, self.writes)

    def batch(self):
        return _FakeBatch()


def test_run_mirror_unconfigured(session):
    assert firebase_mirror.is_configured() is False
    result = firebase_mirror.run_mirror(session)
    assert result["ok"] is False
    assert "not configured" in result["error"]


def test_run_mirror_pushes_with_fake_client(session, monkeypatch):
    _seed(session)
    monkeypatch.setattr(firebase_mirror, "is_configured", lambda: True)
    client = FakeClient()

    result = firebase_mirror.run_mirror(session, client=client)

    assert result["ok"] is True
    assert result["pushed"]["logs"] == 1
    assert any(col == "logs" for col, _, _ in client.writes)
    assert any(col == "meta" and doc_id == "overview" for col, doc_id, _ in client.writes)
    assert not any("openrouter" in doc_id for _, doc_id, _ in client.writes)


def test_firebase_status_endpoint(client):
    resp = client.get("/api/sync/firebase/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is False
    assert body["enabled"] is True
    assert body["last_mirror_at"] is None
