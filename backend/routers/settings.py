
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, field_validator
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import Setting
from backend.scheduler import reschedule

router = APIRouter(prefix="/api/settings", tags=["settings"])

ALLOWED_THEME_VALUES = {"dark", "light"}


def _coerce_bool(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return "true" if str(value).strip().lower() in ("true", "1", "yes", "on") else "false"


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reminder_enabled: bool | None = None
    reminder_time: str | None = None
    theme: str | None = None
    channel_os_toast: bool | None = None
    channel_browser_overlay: bool | None = None
    channel_telegram: bool | None = None
    channel_discord: bool | None = None
    telegram_webhook_url: str | None = None
    discord_webhook_url: str | None = None

    @field_validator("reminder_time")
    @classmethod
    def _validate_time(cls, v):
        if v is None:
            return v
        v = v.strip()
        parts = v.split(":")
        if len(parts) != 2 or not (parts[0].isdigit() and parts[1].isdigit()):
            raise ValueError("reminder_time must be in HH:MM format (00:00-23:59)")
        hour, minute = int(parts[0]), int(parts[1])
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError("reminder_time must be in HH:MM format (00:00-23:59)")
        return f"{hour:02d}:{minute:02d}"

    @field_validator("theme")
    @classmethod
    def _validate_theme(cls, v):
        if v is None:
            return v
        if v not in ALLOWED_THEME_VALUES:
            raise ValueError(f"theme must be one of {sorted(ALLOWED_THEME_VALUES)}")
        return v


@router.get("")
def get_settings(session: Session = Depends(get_session)):
    rows = session.exec(select(Setting)).all()
    return {row.key: row.value for row in rows}


@router.put("")
def update_settings(payload: SettingsUpdate, session: Session = Depends(get_session)):
    data = payload.model_dump(exclude_unset=True)

    coerced: dict[str, str] = {}
    if "reminder_enabled" in data:
        coerced["reminder_enabled"] = _coerce_bool(data["reminder_enabled"])
    if "reminder_time" in data:
        coerced["reminder_time"] = data["reminder_time"]
    if "theme" in data:
        coerced["theme"] = data["theme"]
    if "channel_os_toast" in data:
        coerced["channel_os_toast"] = _coerce_bool(data["channel_os_toast"])
    if "channel_browser_overlay" in data:
        coerced["channel_browser_overlay"] = _coerce_bool(data["channel_browser_overlay"])
    if "channel_telegram" in data:
        coerced["channel_telegram"] = _coerce_bool(data["channel_telegram"])
    if "channel_discord" in data:
        coerced["channel_discord"] = _coerce_bool(data["channel_discord"])
    if "telegram_webhook_url" in data:
        coerced["telegram_webhook_url"] = data["telegram_webhook_url"] or ""
    if "discord_webhook_url" in data:
        coerced["discord_webhook_url"] = data["discord_webhook_url"] or ""

    for key, value in coerced.items():
        existing = session.get(Setting, key)
        if existing:
            existing.value = value
            session.add(existing)
        else:
            session.add(Setting(key=key, value=value))
    session.commit()

    if {"reminder_enabled", "reminder_time"} & set(coerced.keys()):
        reschedule()

    rows = session.exec(select(Setting)).all()
    return {row.key: row.value for row in rows}
