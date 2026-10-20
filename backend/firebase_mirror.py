"""Firebase mirror — one-way push of the local SQLite data to Firestore.

SQLite stays authoritative: this module only reads it, then writes plain
documents to Firestore so a phone can read the dashboard and the data survives
losing the laptop. Disabled until COMPANION_FIREBASE_CREDENTIALS points at a
service-account JSON; the firebase-admin import is lazy so the rest of the app
runs without the dependency configured.

Layout (doc id = row id):
  models/{id}, categories/{id}, logs/{id}
  settings/{key}          — non-secret settings only (credentials never leave)
  meta/state              — mirror bookkeeping (counts, timestamp)
  meta/overview, meta/timeline, meta/leaderboard,
  meta/matrix, meta/spend, meta/monthly — precomputed stats snapshots so the
  phone view is a handful of document reads instead of client-side maths.

Deletes are not propagated (a mirror, not a sync): rows removed locally stay in
Firestore until the next full push replaces them; acceptable for a backup view.
"""
import logging
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from backend.config import settings
from backend.models import Category, LogEntry, Model, Setting

logger = logging.getLogger(__name__)

MIRROR_ENABLED_KEY = "firebase_mirror_enabled"
LAST_MIRROR_KEY = "last_firebase_mirror_at"
BATCH_SIZE = 400
SECRET_HINTS = ("token", "secret", "password", "api_key", "credential", "private", "key")

_client = None


def is_configured() -> bool:
    path = (settings.firebase_credentials or "").strip()
    return bool(path) and Path(path).is_file()


def is_enabled(session: Session) -> bool:
    row = session.get(Setting, MIRROR_ENABLED_KEY)
    value = (row.value if row is not None and row.value else "true") or "true"
    return value.strip().lower() in ("true", "1", "yes", "on")


def _get_client():
    """Build the Firestore client lazily (imports firebase-admin on demand)."""
    global _client
    if _client is not None:
        return _client
    import firebase_admin
    from firebase_admin import credentials, firestore

    cred = credentials.Certificate(settings.firebase_credentials)
    options = (
        {"projectId": settings.firebase_project_id}
        if settings.firebase_project_id
        else None
    )
    try:
        app = firebase_admin.get_app()
    except ValueError:
        app = firebase_admin.initialize_app(cred, options)
    _client = firestore.client(app)
    return _client


def _jsonable(value: Any) -> Any:
    """Firestore only accepts primitives/lists/maps — flatten pydantic models,
    enums and datetimes the same way the API serializes them."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    if hasattr(value, "model_dump"):
        return _jsonable(value.model_dump())
    return value


def _row_payload(instance: Any) -> dict[str, Any]:
    return _jsonable(instance.model_dump())


def _settings_documents(session: Session) -> dict[str, dict[str, str]]:
    docs: dict[str, dict[str, str]] = {}
    for row in session.exec(select(Setting)).all():
        if any(hint in row.key.lower() for hint in SECRET_HINTS):
            continue
        docs[row.key] = {"value": row.value or ""}
    return docs


def _stats_snapshots(session: Session) -> dict[str, Any]:
    from backend.routers import stats as stats_router

    month = datetime.now(UTC).strftime("%Y-%m")
    return {
        "overview": _jsonable(stats_router.overview(session=session)),
        "timeline": {"points": _jsonable(stats_router.timeline(days=90, session=session))},
        "leaderboard": {"entries": _jsonable(stats_router.leaderboard(session=session))},
        "matrix": _jsonable(stats_router.matrix(session=session)),
        "spend": _jsonable(stats_router.spend(days=30, session=session)),
        "monthly": _jsonable(stats_router.monthly(month=month, session=session)),
    }


def collect_documents(session: Session) -> dict[str, dict[str, dict[str, Any]]]:
    """Pure read of everything the mirror pushes: {collection: {doc_id: doc}}.

    Split from the push so tests can assert the payload without Firebase.
    """
    models = session.exec(select(Model)).all()
    categories = session.exec(select(Category)).all()
    logs = session.exec(select(LogEntry)).all()

    return {
        "models": {str(m.id): _row_payload(m) for m in models},
        "categories": {str(c.id): _row_payload(c) for c in categories},
        "logs": {str(e.id): _row_payload(e) for e in logs},
        "settings": _settings_documents(session),
        "meta": {
            "state": {
                "mirrored_at": datetime.now(UTC).replace(tzinfo=None).isoformat(),
                "counts": {
                    "models": len(models),
                    "categories": len(categories),
                    "logs": len(logs),
                },
                "source": "comp[AI]on",
            },
            **_stats_snapshots(session),
        },
    }


def push_documents(
    client, documents: dict[str, dict[str, dict[str, Any]]]
) -> dict[str, int]:
    pushed: dict[str, int] = {}
    for name, docs in documents.items():
        items = list(docs.items())
        for start in range(0, len(items), BATCH_SIZE):
            batch = client.batch()
            for doc_id, payload in items[start : start + BATCH_SIZE]:
                batch.set(client.collection(name).document(doc_id), payload)
            batch.commit()
        pushed[name] = len(items)
    return pushed


def run_mirror(session: Session, client=None) -> dict[str, Any]:
    if not is_configured():
        return {
            "ok": False,
            "error": "Firebase mirror not configured — set COMPANION_FIREBASE_CREDENTIALS "
            "to a service-account JSON path.",
        }
    if not is_enabled(session):
        return {"ok": False, "error": "Firebase mirror disabled in settings."}

    documents = collect_documents(session)
    try:
        pushed = push_documents(client or _get_client(), documents)
    except Exception as exc:  # auth/network problems are user-actionable
        logger.exception("firebase mirror failed")
        return {"ok": False, "error": str(exc)}

    now_str = datetime.now(UTC).replace(tzinfo=None).isoformat()
    from backend.hermes_sync import set_setting

    set_setting(session, LAST_MIRROR_KEY, now_str)
    session.commit()

    result = {"ok": True, "last_mirror_at": now_str, "pushed": pushed}
    logger.info("firebase mirror pushed: %s", pushed)
    return result
