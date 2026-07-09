from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import Setting

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def get_settings(session: Session = Depends(get_session)):
    rows = session.exec(select(Setting)).all()
    return {row.key: row.value for row in rows}


@router.put("")
def update_settings(payload: dict, session: Session = Depends(get_session)):
    for key, value in payload.items():
        existing = session.get(Setting, key)
        if existing:
            existing.value = str(value)
            session.add(existing)
        else:
            session.add(Setting(key=key, value=str(value)))
    session.commit()
    rows = session.exec(select(Setting)).all()
    return {row.key: row.value for row in rows}
