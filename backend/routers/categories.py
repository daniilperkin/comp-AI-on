from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import Category, CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("")
def list_categories(session: Session = Depends(get_session)):
    stmt = select(Category).order_by(Category.name)
    return session.exec(stmt).all()


@router.post("", status_code=201)
def create_category(payload: CategoryCreate, session: Session = Depends(get_session)):
    entry = Category(**payload.model_dump())
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.patch("/{category_id}")
def update_category(category_id: int, payload: CategoryUpdate, session: Session = Depends(get_session)):
    entry = session.get(Category, category_id)
    if entry is None:
        raise HTTPException(404, "Category not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(entry, k, v)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, session: Session = Depends(get_session)):
    entry = session.get(Category, category_id)
    if entry is None:
        raise HTTPException(404, "Category not found")
    session.delete(entry)
    session.commit()
