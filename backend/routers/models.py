from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import Model, ModelCreate, ModelUpdate

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
def list_models(active_only: bool = False, session: Session = Depends(get_session)):
    stmt = select(Model).order_by(Model.name)
    if active_only:
        stmt = stmt.where(Model.is_active == True)
    return session.exec(stmt).all()


@router.post("", status_code=201)
def create_model(payload: ModelCreate, session: Session = Depends(get_session)):
    entry = Model(**payload.model_dump())
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.patch("/{model_id}")
def update_model(model_id: int, payload: ModelUpdate, session: Session = Depends(get_session)):
    entry = session.get(Model, model_id)
    if entry is None:
        raise HTTPException(404, "Model not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(entry, k, v)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/{model_id}", status_code=204)
def delete_model(model_id: int, session: Session = Depends(get_session)):
    entry = session.get(Model, model_id)
    if entry is None:
        raise HTTPException(404, "Model not found")
    session.delete(entry)
    session.commit()
