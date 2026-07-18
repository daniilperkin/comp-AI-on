import os
import subprocess
import sys
from datetime import datetime

import httpx
from sqlmodel import Session, select

from backend.models import Notification, Setting


def get_setting(session: Session, key: str, default: str = "") -> str:
    s = session.get(Setting, key)
    return s.value if s else default


def is_channel_enabled(session: Session, channel: str) -> bool:
    key = f"channel_{channel}"
    return get_setting(session, key, "false").lower() == "true"


_PS_TOAST_SCRIPT = """
$ErrorActionPreference = 'Stop'
if (-not (Get-Module -ListAvailable -Name BurntToast)) {
    Write-Error 'BurntToast module not installed. Run: Install-Module BurntToast -Scope CurrentUser'
    exit 1
}
Import-Module BurntToast -ErrorAction Stop
New-BurntToastNotification -Text $env:COMPANION_NOTIF_TITLE, $env:COMPANION_NOTIF_BODY
Write-Output 'OK'
"""


def send_os_toast(title: str, body: str) -> bool:
    env = os.environ.copy()
    env["COMPANION_NOTIF_TITLE"] = title
    env["COMPANION_NOTIF_BODY"] = body
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", _PS_TOAST_SCRIPT],
            capture_output=True,
            text=True,
            timeout=30,
            env=env,
        )
        if "OK" not in result.stdout:
            msg = (result.stderr or result.stdout or "").strip()
            print(f"[notify] OS toast failed: {msg}", file=sys.stderr)
        return "OK" in result.stdout
    except Exception as e:
        print(f"[notify] OS toast failed: {e}", file=sys.stderr)
        return False


def send_browser_notification(session: Session, title: str, body: str):
    notif = Notification(title=title, body=body, channel="browser", shown=False)
    session.add(notif)
    session.commit()


def send_telegram_webhook(session: Session, title: str, body: str) -> bool:
    url = get_setting(session, "telegram_webhook_url", "")
    if not url:
        print("[notify] Telegram webhook URL not configured", file=sys.stderr)
        return False
    try:
        resp = httpx.post(url, json={"text": f"{title}\n\n{body}"}, timeout=10)
        return resp.is_success
    except Exception as e:
        print(f"[notify] Telegram webhook failed: {e}", file=sys.stderr)
        return False


def send_discord_webhook(session: Session, title: str, body: str) -> bool:
    url = get_setting(session, "discord_webhook_url", "")
    if not url:
        print("[notify] Discord webhook URL not configured", file=sys.stderr)
        return False
    try:
        resp = httpx.post(
            url,
            json={"embeds": [{"title": title, "description": body, "color": 0x199CE8}]},
            timeout=10,
        )
        return resp.is_success
    except Exception as e:
        print(f"[notify] Discord webhook failed: {e}", file=sys.stderr)
        return False


def dispatch_reminder(session: Session):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    existing = session.exec(
        select(Notification).where(
            Notification.channel == "browser",
            Notification.created_at >= today_start,
            Notification.title.like("Daily reminder%"),
        )
    ).first()

    if existing:
        return

    title = "comp[AI]on — Daily reminder"
    body = "You haven't logged an AI model interaction today. Add a quick entry!"

    if is_channel_enabled(session, "os_toast"):
        send_os_toast(title, body)

    if is_channel_enabled(session, "browser_overlay"):
        send_browser_notification(session, title, body)

    if is_channel_enabled(session, "telegram"):
        send_telegram_webhook(session, title, body)

    if is_channel_enabled(session, "discord"):
        send_discord_webhook(session, title, body)


def dispatch_test(session: Session, channel: str):
    title = "comp[AI]on — Test notification"
    body = "This is a test notification. If you see this, the channel is working!"

    if channel == "os_toast":
        return send_os_toast(title, body)
    elif channel == "browser_overlay":
        send_browser_notification(session, title, body)
        return True
    elif channel == "telegram":
        return send_telegram_webhook(session, title, body)
    elif channel == "discord":
        return send_discord_webhook(session, title, body)
    return False
