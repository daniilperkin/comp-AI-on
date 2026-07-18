import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

# Ensure repo root on sys.path (for `backend.*` imports)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


@pytest.fixture(name="engine")
def fixture_engine(monkeypatch):
    """Create an in-memory SQLite engine with WAL + FK pragmas and the full schema."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False, "timeout": 30},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _set_pragmas(dbapi_connection, _record):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    # Stub out alembic-based init_db so we use create_all directly for tests
    import backend.db as db_module

    def _test_init_db():
        import backend.models  # noqa: F401
        from backend.seed import run_seed

        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            run_seed(session)

    monkeypatch.setattr(db_module, "engine", engine)
    monkeypatch.setattr(db_module, "_run_alembic", _test_init_db)

    # Also patch the scheduler so it doesn't try to use the real engine
    import backend.scheduler as sched_module
    monkeypatch.setattr(sched_module, "engine", engine)

    yield engine

    engine.dispose()


@pytest.fixture(name="client")
def fixture_client(engine):
    """FastAPI TestClient backed by the in-memory engine."""
    from backend.main import app
    from backend.db import get_session

    def _override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_session

    # Trigger init_db (runs alembic -> stubbed to create_all + seed)
    from backend.db import init_db
    init_db()

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture(name="session")
def fixture_session(engine):
    """Raw SQLModel Session for direct DB assertions."""
    with Session(engine) as s:
        yield s
