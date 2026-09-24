from sqlmodel import Session, select

from backend.models import Category, Model, ModelKind, Setting

DEFAULT_MODELS = [
    ("Claude 3.5 Sonnet", ModelKind.web, "Anthropic"),
    ("GPT-4o", ModelKind.web, "OpenAI"),
    ("Gemini 1.5 Pro", ModelKind.web, "Google"),
    ("Cursor", ModelKind.agentic, "Anysphere"),
    ("GitHub Copilot", ModelKind.agentic, "GitHub"),
    ("Llama 3.1", ModelKind.local, "Meta"),
]

DEFAULT_CATEGORIES = [
    ("Coding", "#60a5fa"),
    ("Debugging", "#f87171"),
    ("Refactoring", "#fbbf24"),
    ("Writing", "#34d399"),
    ("Design", "#a78bfa"),
    ("Research", "#22d3ee"),
    ("Architecture", "#f472b6"),
]

DEFAULT_SETTINGS = {
    "reminder_enabled": "true",
    "reminder_time": "18:00",
    "channel_os_toast": "true",
    "channel_browser_overlay": "true",
}

SEED_VERSION = "2"


def _upsert_models(session: Session):
    existing = {m.name: m for m in session.exec(select(Model)).all()}
    for name, kind, vendor in DEFAULT_MODELS:
        m = existing.get(name)
        if m is None:
            session.add(Model(name=name, kind=kind, vendor=vendor))


def _upsert_categories(session: Session):
    existing = {c.name: c for c in session.exec(select(Category)).all()}
    for name, color in DEFAULT_CATEGORIES:
        c = existing.get(name)
        if c is None:
            session.add(Category(name=name, color=color))


def _upsert_settings(session: Session):
    for key, value in DEFAULT_SETTINGS.items():
        existing = session.get(Setting, key)
        if existing is None:
            session.add(Setting(key=key, value=value))


def run_seed(session: Session):
    _upsert_models(session)
    _upsert_categories(session)
    _upsert_settings(session)

    seed_version = session.get(Setting, "seed_version")
    if seed_version is None:
        session.add(Setting(key="seed_version", value=SEED_VERSION))
    else:
        seed_version.value = SEED_VERSION
        session.add(seed_version)

    session.commit()
