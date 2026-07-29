from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlmodel import Session, select

from backend.db import engine
from backend.models import LogEntry, Setting
from backend.notify import dispatch_reminder

scheduler: BackgroundScheduler | None = None


def get_setting(session: Session, key: str, default: str = "") -> str:
    s = session.get(Setting, key)
    return s.value if s else default


def _local_tz():
    return datetime.now(timezone.utc).astimezone().tzinfo


def reminder_job():
    with Session(engine) as session:
        enabled = get_setting(session, "reminder_enabled", "true").lower() == "true"
        if not enabled:
            return

        local_now = datetime.now(_local_tz())
        today_start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = today_start_local.astimezone(timezone.utc).replace(tzinfo=None)

        has_entry_today = session.exec(
            select(LogEntry).where(LogEntry.created_at >= today_start_utc).limit(1)
        ).first()

        if not has_entry_today:
            dispatch_reminder(session)


def parse_time(time_str: str) -> tuple[int, int]:
    parts = time_str.strip().split(":")
    if len(parts) != 2:
        return 18, 0
    return int(parts[0]), int(parts[1])


def start_scheduler():
    global scheduler
    if scheduler is not None:
        return

    scheduler = BackgroundScheduler()
    scheduler.start()
    reschedule()


def reschedule():
    if scheduler is None:
        return

    existing = scheduler.get_job("daily_reminder")
    if existing:
        scheduler.remove_job("daily_reminder")

    with Session(engine) as session:
        time_str = get_setting(session, "reminder_time", "18:00")
        enabled = get_setting(session, "reminder_enabled", "true").lower() == "true"

    if not enabled:
        return

    hour, minute = parse_time(time_str)
    scheduler.add_job(
        reminder_job,
        CronTrigger(hour=hour, minute=minute, timezone=_local_tz()),
        id="daily_reminder",
        replace_existing=True,
    )


def stop_scheduler():
    global scheduler
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        scheduler = None
