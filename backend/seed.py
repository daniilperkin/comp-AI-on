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
    "theme": "dark",
}


def run_seed(session: Session):
    if session.exec(select(Model)).first() is None:
        for name, kind, vendor in DEFAULT_MODELS:
            session.add(Model(name=name, kind=kind, vendor=vendor))

    if session.exec(select(Category)).first() is None:
        for name, color in DEFAULT_CATEGORIES:
            session.add(Category(name=name, color=color))

    if session.exec(select(Setting)).first() is None:
        for k, v in DEFAULT_SETTINGS.items():
            session.add(Setting(key=k, value=v))

    session.commit()
