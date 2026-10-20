"""Usage-sync endpoints: status + manual run (OpenRouter, Hermes, Firebase mirror)."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from backend import firebase_mirror, hermes_sync
from backend import openrouter_sync as sync_mod
from backend.db import get_session

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncRunRequest(BaseModel):
    days_back: int = 7


def _status(session: Session) -> dict[str, Any]:
    return {
        "configured": sync_mod.is_configured(session),
        "enabled": sync_mod.get_setting(session, sync_mod.SYNC_ENABLED_KEY).lower() == "true",
        "has_api_key": bool(sync_mod.get_setting(session, sync_mod.API_KEY_KEY)),
        "last_sync_at": sync_mod.get_setting(session, sync_mod.LAST_SYNC_KEY) or None,
    }


def _hermes_status(session: Session) -> dict[str, Any]:
    home = hermes_sync.hermes_home()
    profiles = [
        {"name": name, "path": str(path)}
        for name, path in hermes_sync.discover_profile_dbs(home)
    ]
    return {
        "enabled": hermes_sync.is_enabled(session),
        "hermes_home": str(home),
        "profiles_found": profiles,
        "last_sync_at": hermes_sync.get_setting(session, hermes_sync.LAST_SYNC_KEY) or None,
    }


@router.get("/status")
def sync_status(session: Session = Depends(get_session)):
    return _status(session)


@router.post("/run")
def run_sync(payload: SyncRunRequest | None = None, session: Session = Depends(get_session)):
    body = payload or SyncRunRequest()
    if not 1 <= body.days_back <= 90:
        raise HTTPException(422, "days_back must be between 1 and 90")
    result = sync_mod.run_sync(session, days_back=body.days_back)
    if not result.get("ok"):
        # Config/transport problems are user-actionable, not server faults.
        raise HTTPException(400, result.get("error", "sync failed"))
    return {**result, "status": _status(session)}


@router.get("/hermes/status")
def hermes_sync_status(session: Session = Depends(get_session)):
    return _hermes_status(session)


@router.post("/hermes/run")
def run_hermes_sync(session: Session = Depends(get_session)):
    result = hermes_sync.run_sync(session)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "sync failed"))
    return {**result, "status": _hermes_status(session)}


def _firebase_status(session: Session) -> dict[str, Any]:
    return {
        "configured": firebase_mirror.is_configured(),
        "enabled": firebase_mirror.is_enabled(session),
        "last_mirror_at": hermes_sync.get_setting(session, firebase_mirror.LAST_MIRROR_KEY)
        or None,
    }


@router.get("/firebase/status")
def firebase_sync_status(session: Session = Depends(get_session)):
    return _firebase_status(session)


@router.post("/firebase/run")
def run_firebase_mirror(session: Session = Depends(get_session)):
    result = firebase_mirror.run_mirror(session)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "mirror failed"))
    return {**result, "status": _firebase_status(session)}
