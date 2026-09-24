"""Tests for OpenRouter usage sync (mocked HTTP; no real network)."""
from unittest.mock import patch

from backend import openrouter_sync as sync_mod
from backend.models import LogEntry


def _configure(session, key="sk-or-test"):
    sync_mod.set_setting(session, sync_mod.API_KEY_KEY, key)
    sync_mod.set_setting(session, sync_mod.SYNC_ENABLED_KEY, "true")
    session.commit()


def _gen(gid="gen-1", model="openai/gpt-4o-mini", prompt=1000, completion=500, cost=0.001):
    return {
        "id": gid,
        "model": model,
        "created_at": "2026-08-24T10:00:00Z",
        "token_usage": {"prompt": prompt, "completion": completion},
        "cost": cost,
    }


# ---------------------------------------------------------------------------
# filter_new / dedupe
# ---------------------------------------------------------------------------

def test_filter_new_separates_known_from_new(client, session):
    session.add(LogEntry(external_id="gen-known", cost_usd=0.01))
    session.commit()

    gens = [_gen("gen-known"), _gen("gen-new")]
    new, skipped = sync_mod.filter_new(session, gens)
    assert [g["id"] for g in new] == ["gen-new"]
    assert skipped == 1


def test_filter_new_keeps_generations_without_id(client, session):
    gen = _gen()
    del gen["id"]
    new, skipped = sync_mod.filter_new(session, [gen])
    assert len(new) == 1
    assert skipped == 0


# ---------------------------------------------------------------------------
# to_log_entry_create mapping
# ---------------------------------------------------------------------------

def test_mapper_matches_existing_model_by_slug_tail(client, session):
    from backend.models import Model

    m = Model(name="gpt-4o-mini", kind="web")  # slug tail matches
    session.add(m)
    session.commit()

    mapped = sync_mod.to_log_entry_create(_gen(), sync_mod._load_model_map(session))
    assert mapped is not None
    payload, _ts = mapped
    assert payload.model_id == m.id
    assert payload.model_name_text is None  # matched -> no text fallback
    assert payload.input_tokens == 1000
    assert payload.output_tokens == 500
    assert abs(payload.cost_usd - 0.001) < 1e-12
    assert payload.task_description == sync_mod.AUTO_IMPORT_MARKER


def test_mapper_unknown_model_uses_text_fallback(client, session):
    mapped = sync_mod.to_log_entry_create(
        _gen(model="somevendor/never-seen"), sync_mod._load_model_map(session)
    )
    assert mapped is not None
    payload, _ts = mapped
    assert payload.model_id is None
    assert payload.model_name_text == "somevendor/never-seen"


def test_mapper_empty_generation_returns_none(session):
    assert sync_mod.to_log_entry_create({}, {}) is None


def test_mapper_parses_epoch_millis_timestamp(session):
    gen = {
        "id": "gen-ts",
        "model": "x",
        "startTime": 1756000000000,  # epoch millis
        "token_usage": {"prompt": 10, "completion": 5},
        "cost": 0.0,
    }
    mapped = sync_mod.to_log_entry_create(gen, {})
    assert mapped is not None
    _payload, ts = mapped
    assert ts is not None
    assert ts.tzinfo is None  # naive UTC like the rest of the app


# ---------------------------------------------------------------------------
# run_sync orchestration
# ---------------------------------------------------------------------------

def test_run_sync_requires_api_key(client, session):
    result = sync_mod.run_sync(session)
    assert result["ok"] is False
    assert "key" in result["error"].lower()


def test_run_sync_creates_entries_and_is_idempotent(client, session):
    _configure(session)

    with patch.object(sync_mod, "fetch_activity", return_value=[_gen("g1"), _gen("g2")]):
        first = sync_mod.run_sync(session)
    assert first["ok"] is True
    assert first["created"] == 2
    assert first["skipped_existing"] == 0
    assert first["last_sync_at"]

    # Re-sync with the same data: everything already imported.
    with patch.object(sync_mod, "fetch_activity", return_value=[_gen("g1"), _gen("g2")]):
        second = sync_mod.run_sync(session)
    assert second["created"] == 0
    assert second["skipped_existing"] == 2


def test_run_sync_transport_error_is_user_safe(client, session):
    _configure(session)
    with patch.object(
        sync_mod, "fetch_activity", side_effect=RuntimeError("Could not reach OpenRouter")
    ):
        result = sync_mod.run_sync(session)
    assert result["ok"] is False
    assert "reach" in result["error"]


# ---------------------------------------------------------------------------
# Sync endpoints
# ---------------------------------------------------------------------------

def test_sync_status_endpoint(client, session):
    resp = client.get("/api/sync/status")
    assert resp.status_code == 200
    data = resp.json()
    assert set(data.keys()) == {"configured", "enabled", "has_api_key", "last_sync_at"}
    assert data["configured"] is False  # nothing configured yet


def test_sync_run_without_key_returns_400(client):
    resp = client.post("/api/sync/run", json={"days_back": 7})
    assert resp.status_code == 400
    assert "key" in resp.json()["detail"].lower()


def test_sync_run_rejects_out_of_range_days(client):
    resp = client.post("/api/sync/run", json={"days_back": 400})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Real /api/v1/activity shape (daily aggregates, no id) — mocked HTTP
# ---------------------------------------------------------------------------

def _activity_row(date, endpoint="ep-1"):
    return {
        "date": date,
        "model": "openai/gpt-4.1",
        "model_permaslug": "openai/gpt-4.1-2025-04-14",
        "endpoint_id": endpoint,
        "usage": 0.05,
        "requests": 10,
        "prompt_tokens": 1500,
        "completion_tokens": 800,
    }


class _Resp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status

    def json(self):
        return self._p


def test_activity_rows_import_with_tokens_cost_and_dedupe(client, session):
    from datetime import datetime, timedelta

    _configure(session)
    day = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    old = (datetime.utcnow() - timedelta(days=20)).strftime("%Y-%m-%d")
    payload = {"data": [_activity_row(day), _activity_row(old, "ep-2")]}
    with patch("backend.openrouter_sync.httpx.get", return_value=_Resp(payload)):
        first = sync_mod.run_sync(session, days_back=7)
        second = sync_mod.run_sync(session, days_back=7)
    assert first["created"] == 1  # 20-day-old row filtered out
    assert second["created"] == 0 and second["skipped_existing"] == 1
    row = session.exec(__import__("sqlmodel").select(LogEntry)).one()
    assert (row.input_tokens, row.output_tokens, row.cost_usd) == (1500, 800, 0.05)
    assert row.created_at.strftime("%Y-%m-%d") == day
    assert row.external_id == f"or-activity:{day}:ep-1"


def test_settings_never_return_api_key_in_full(client, session):
    secret = "sk-or-v1-supersecret1234"
    r = client.put("/api/settings", json={"openrouter_api_key": secret,
                                          "openrouter_sync_enabled": True,
                                          "daily_budget_usd": "2.5"})
    assert r.status_code == 200, r.text
    assert secret not in r.text and r.json()["openrouter_api_key"].endswith("1234")
    assert secret not in client.get("/api/settings").text
    # Blank / echoed mask keeps the stored key; explicit clear removes it.
    client.put("/api/settings", json={"openrouter_api_key": r.json()["openrouter_api_key"]})
    assert sync_mod.get_setting(session, sync_mod.API_KEY_KEY) == secret
    client.put("/api/settings", json={"clear_openrouter_api_key": True})
    session.expire_all()
    assert sync_mod.get_setting(session, sync_mod.API_KEY_KEY) == ""
