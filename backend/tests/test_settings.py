"""Tests for settings validation and typed SettingsUpdate schema."""


def test_get_default_settings(client):
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["reminder_enabled"] == "true"
    assert data["reminder_time"] == "18:00"
    assert "theme" not in data
    assert data["channel_os_toast"] == "true"
    assert data["channel_browser_overlay"] == "true"
    assert data["seed_version"] == "3"
    assert data["hermes_sync_enabled"] == "true"


def test_update_settings_valid(client):
    resp = client.put("/api/settings", json={"reminder_time": "19:30", "theme": "light"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["reminder_time"] == "19:30"
    assert data["theme"] == "light"


def test_update_settings_invalid_time_format(client):
    resp = client.put("/api/settings", json={"reminder_time": "invalid"})
    assert resp.status_code == 422


def test_update_settings_invalid_time_range(client):
    resp = client.put("/api/settings", json={"reminder_time": "25:99"})
    assert resp.status_code == 422


def test_update_settings_invalid_theme(client):
    resp = client.put("/api/settings", json={"theme": "purple"})
    assert resp.status_code == 422


def test_update_settings_unknown_key_rejected(client):
    resp = client.put("/api/settings", json={"unknown_key": "value"})
    assert resp.status_code == 422


def test_update_settings_bool_coercion(client):
    resp = client.put("/api/settings", json={"reminder_enabled": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["reminder_enabled"] == "true"

    resp = client.put("/api/settings", json={"reminder_enabled": False})
    assert resp.status_code == 200
    data = resp.json()
    assert data["reminder_enabled"] == "false"


def test_update_settings_telegram_webhook_url(client):
    url = "https://api.telegram.org/bot123/sendMessage?chat_id=456"
    resp = client.put("/api/settings", json={"telegram_webhook_url": url})
    assert resp.status_code == 200
    data = resp.json()
    assert data["telegram_webhook_url"] == url


def test_update_settings_empty_webhook_url(client):
    resp = client.put("/api/settings", json={"telegram_webhook_url": ""})
    assert resp.status_code == 200
    data = resp.json()
    assert data["telegram_webhook_url"] == ""
