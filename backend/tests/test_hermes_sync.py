"""Tests for the Hermes usage sync (state.db → log entries)."""
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlmodel import select

from backend import hermes_sync
from backend.models import LogEntry, Model, ModelKind, Setting

SCHEMA = """
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    model TEXT,
    title TEXT,
    cwd TEXT,
    git_branch TEXT,
    message_count INTEGER,
    tool_call_count INTEGER,
    started_at REAL,
    ended_at REAL
);
CREATE TABLE session_model_usage (
    session_id TEXT NOT NULL,
    model TEXT NOT NULL,
    billing_provider TEXT NOT NULL DEFAULT '',
    billing_base_url TEXT NOT NULL DEFAULT '',
    billing_mode TEXT NOT NULL DEFAULT '',
    task TEXT NOT NULL DEFAULT '',
    api_call_count INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    reasoning_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd REAL NOT NULL DEFAULT 0,
    actual_cost_usd REAL NOT NULL DEFAULT 0,
    cost_status TEXT,
    cost_source TEXT,
    first_seen REAL,
    last_seen REAL,
    PRIMARY KEY (session_id, model, billing_provider, billing_base_url, billing_mode, task)
);
"""

SESSIONS_INSERT = (
    "INSERT INTO sessions (id, source, model, title, cwd, git_branch, "
    "message_count, tool_call_count, started_at, ended_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
)
USAGE_INSERT = (
    "INSERT INTO session_model_usage (session_id, model, billing_provider, "
    "billing_base_url, billing_mode, task, api_call_count, input_tokens, "
    "output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, "
    "estimated_cost_usd, actual_cost_usd, cost_status, cost_source, first_seen, "
    "last_seen) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
)


@pytest.fixture(autouse=True)
def _schema(engine):
    """Create schema + seed on the per-test in-memory engine. The client
    fixture does this implicitly; session-only tests need it explicitly."""
    from backend.db import init_db

    init_db()


def _make_profile(root: Path, name: str, sessions=(), usage=()) -> Path:
    """Create <root>/state.db (name='default') or <root>/profiles/<name>/state.db."""
    db_dir = root if name == "default" else root / "profiles" / name
    db_dir.mkdir(parents=True, exist_ok=True)
    db = db_dir / "state.db"
    con = sqlite3.connect(db)
    con.executescript(SCHEMA)
    if sessions:
        con.executemany(SESSIONS_INSERT, sessions)
    if usage:
        con.executemany(USAGE_INSERT, usage)
    con.commit()
    con.close()
    return db


def _session(sid="s1", source="desktop", title="Fix the bug", cwd="C:/repo", branch="main"):
    return (sid, source, "deepseek/deepseek-v4.1-flash", title, cwd, branch, 12, 7, 1000.0, 2000.0)


def _usage(
    sid="s1", model="deepseek/deepseek-v4.1-flash", provider="openrouter",
    task="", inp=100, out=20, cr=5000, cw=30, rt=10,
    est=0.0123, act=0.0, status="estimated", first_seen=1000.0, last_seen=1500.0,
):
    return (
        sid, model, provider, "https://openrouter.ai/api/v1", "", task, 5,
        inp, out, cr, cw, rt, est, act, status, "provider_models_api",
        first_seen, last_seen,
    )


def test_discover_profile_dbs(tmp_path):
    _make_profile(tmp_path, "default")
    _make_profile(tmp_path, "companion")
    _make_profile(tmp_path, "sprintstart")
    _make_profile(tmp_path, ".deleted")  # retired profiles are parked here — skip
    dbs = hermes_sync.discover_profile_dbs(tmp_path)
    assert [name for name, _ in dbs] == ["default", "companion", "sprintstart"]


def test_run_sync_maps_usage_to_entries(session, tmp_path):
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])

    result = hermes_sync.run_sync(session, home=tmp_path)

    assert result["ok"] is True
    assert result["created"] == 1
    assert result["rows_seen"] == 1
    entry = session.exec(select(LogEntry)).one()
    assert entry.origin == "hermes"
    assert entry.task_description == "auto-imported (hermes)"
    assert entry.input_tokens == 100
    assert entry.output_tokens == 20
    assert entry.cache_read_tokens == 5000
    assert entry.cache_write_tokens == 30
    assert entry.reasoning_tokens == 10
    assert entry.cost_usd == 0.0123
    assert entry.external_id.startswith("hermes:default:s1:")
    assert entry.created_at == datetime.fromtimestamp(1500, tz=UTC).replace(tzinfo=None)
    assert "Fix the bug" in entry.notes
    assert "estimated" in entry.notes
    assert result["profiles"][0]["profile"] == "default"


def test_run_sync_marks_aux_tasks(session, tmp_path):
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage(task="title_generation")])
    hermes_sync.run_sync(session, home=tmp_path)
    entry = session.exec(select(LogEntry)).one()
    assert entry.task_description == "auto-imported (hermes:title_generation)"


def test_run_sync_prefers_actual_cost(session, tmp_path):
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage(est=0.01, act=0.5, status="actual")])
    hermes_sync.run_sync(session, home=tmp_path)
    entry = session.exec(select(LogEntry)).one()
    assert entry.cost_usd == 0.5
    assert "actual" in entry.notes


def test_run_sync_upserts_mutated_rows(session, tmp_path):
    db = _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])
    first = hermes_sync.run_sync(session, home=tmp_path)
    assert first["created"] == 1

    # A live session's usage row keeps accumulating deltas.
    con = sqlite3.connect(db)
    con.execute("UPDATE session_model_usage SET input_tokens = 250, estimated_cost_usd = 0.02")
    con.commit()
    con.close()

    second = hermes_sync.run_sync(session, home=tmp_path)
    assert second["created"] == 0
    assert second["updated"] == 1
    entry = session.exec(select(LogEntry)).one()
    assert entry.input_tokens == 250
    assert entry.cost_usd == 0.02
    assert entry.created_at == datetime.fromtimestamp(1500, tz=UTC).replace(tzinfo=None)


def test_run_sync_unchanged_rerun(session, tmp_path):
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])
    hermes_sync.run_sync(session, home=tmp_path)
    second = hermes_sync.run_sync(session, home=tmp_path)
    assert second["created"] == 0
    assert second["updated"] == 0
    assert second["unchanged"] == 1


def test_run_sync_missing_home(session, tmp_path):
    result = hermes_sync.run_sync(session, home=tmp_path / "nope")
    assert result["ok"] is False
    assert "No Hermes state.db" in result["error"]


def test_run_sync_tolerates_unreadable_profile(session, tmp_path):
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])
    broken = tmp_path / "profiles" / "broken"
    broken.mkdir(parents=True)
    (broken / "state.db").write_bytes(b"this is not a sqlite database" * 50)

    result = hermes_sync.run_sync(session, home=tmp_path)

    assert result["ok"] is True
    assert result["created"] == 1
    by_name = {p["profile"]: p for p in result["profiles"]}
    assert "error" in by_name["broken"]
    assert by_name["default"]["created"] == 1


def test_run_sync_matches_local_model(session, tmp_path):
    session.add(Model(name="deepseek-v4.1-flash", kind="web", vendor="DeepSeek"))
    session.commit()
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])

    hermes_sync.run_sync(session, home=tmp_path)

    entry = session.exec(select(LogEntry)).one()
    assert entry.model_id is not None
    assert entry.model_name_text == "deepseek/deepseek-v4.1-flash"


def test_run_sync_auto_creates_model_for_unknown_slug(session, tmp_path):
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])

    result = hermes_sync.run_sync(session, home=tmp_path)

    assert result["models_created"] == 1
    model = session.exec(
        select(Model).where(Model.name == "deepseek/deepseek-v4.1-flash")
    ).one()
    assert model.kind == ModelKind.web
    assert model.vendor == "openrouter"
    entry = session.exec(select(LogEntry)).one()
    assert entry.model_id == model.id


def test_run_sync_auto_create_is_idempotent(session, tmp_path):
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])
    hermes_sync.run_sync(session, home=tmp_path)
    second = hermes_sync.run_sync(session, home=tmp_path)
    assert second["models_created"] == 0
    assert len(
        session.exec(
            select(Model).where(Model.name == "deepseek/deepseek-v4.1-flash")
        ).all()
    ) == 1


def test_run_sync_backfills_model_id_on_existing_rows(session, tmp_path):
    # Simulate a row imported before auto-create existed: text-only, no FK.
    row = {
        "model": "deepseek/deepseek-v4.1-flash",
        "billing_provider": "openrouter",
        "billing_base_url": "https://openrouter.ai/api/v1",
        "billing_mode": "",
        "task": "",
        "session_id": "s1",
    }
    session.add(LogEntry(
        external_id=hermes_sync._external_id("default", row),
        model_name_text="deepseek/deepseek-v4.1-flash",
        task_description="auto-imported (hermes)",
        origin="hermes",
    ))
    session.commit()

    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])
    hermes_sync.run_sync(session, home=tmp_path)

    entry = session.exec(select(LogEntry)).one()
    assert entry.model_id is not None


def test_run_sync_skips_empty_rows(session, tmp_path):
    empty = _usage(sid="s2", model="", inp=0, out=0, cr=0, cw=0, rt=0, est=0.0)
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage(), empty])
    result = hermes_sync.run_sync(session, home=tmp_path)
    assert result["created"] == 1
    assert result["errors"] == 1
    assert len(session.exec(select(LogEntry)).all()) == 1


def test_hermes_status_endpoint(client, tmp_path, monkeypatch):
    _make_profile(tmp_path, "default")
    _make_profile(tmp_path, "companion")
    monkeypatch.setenv("COMPANION_HERMES_HOME", str(tmp_path))

    resp = client.get("/api/sync/hermes/status")

    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is True
    assert [p["name"] for p in body["profiles_found"]] == ["default", "companion"]
    assert body["last_sync_at"] is None


def test_hermes_run_endpoint(client, tmp_path, monkeypatch):
    _make_profile(tmp_path, "default", sessions=[_session()], usage=[_usage()])
    monkeypatch.setenv("COMPANION_HERMES_HOME", str(tmp_path))

    resp = client.post("/api/sync/hermes/run")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["created"] == 1
    assert body["status"]["last_sync_at"]


def test_hermes_run_endpoint_without_profiles(client, tmp_path, monkeypatch):
    monkeypatch.setenv("COMPANION_HERMES_HOME", str(tmp_path / "missing"))
    resp = client.post("/api/sync/hermes/run")
    assert resp.status_code == 400


def test_hermes_sync_setting_toggle(client, session):
    resp = client.put("/api/settings", json={"hermes_sync_enabled": False})
    assert resp.status_code == 200
    assert resp.json()["hermes_sync_enabled"] == "false"
    assert hermes_sync.is_enabled(session) is False

    resp = client.put("/api/settings", json={"hermes_sync_enabled": True})
    assert resp.status_code == 200
    assert resp.json()["hermes_sync_enabled"] == "true"
    assert hermes_sync.is_enabled(session) is True


def test_hermes_sync_default_enabled_when_unset(session):
    row = session.get(Setting, "hermes_sync_enabled")
    if row is not None:
        session.delete(row)
        session.commit()
    assert hermes_sync.is_enabled(session) is True
