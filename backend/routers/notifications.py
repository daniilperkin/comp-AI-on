from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import Notification
from backend.notify import dispatch_test
from backend.scheduler import reschedule

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def get_pending_notifications(session: Session = Depends(get_session)):
    notifs = session.exec(
        select(Notification)
        .where(Notification.shown == False)
        .order_by(Notification.created_at.desc())
        .limit(5)
    ).all()
    return notifs


@router.patch("/{notif_id}/shown")
def mark_shown(notif_id: int, session: Session = Depends(get_session)):
    n = session.get(Notification, notif_id)
    if n is None:
        raise HTTPException(404, "Notification not found")
    n.shown = True
    session.add(n)
    session.commit()
    return n


class TestRequest(BaseModel):
    channel: str


@router.post("/test")
def test_notification(payload: TestRequest, session: Session = Depends(get_session)):
    if payload.channel not in ("os_toast", "browser_overlay"):
        raise HTTPException(400, "Invalid channel. Use 'os_toast' or 'browser_overlay'.")

    success = dispatch_test(session, payload.channel)
    return {"success": success, "channel": payload.channel}


@router.post("/reschedule")
def trigger_reschedule():
    reschedule()
    return {"status": "rescheduled"}
