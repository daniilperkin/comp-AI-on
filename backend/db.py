import os

from sqlalchemy import event, inspect
from sqlmodel import Session, create_engine

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
SQLITE_URL = f"sqlite:///{DB_PATH}"

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")
ALEMBIC_INI = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


def get_session():
    with Session(engine) as session:
        yield session


def _run_alembic():
    from alembic import command
    from alembic.config import Config

    cfg = Config(ALEMBIC_INI)
    cfg.set_main_option("script_location", MIGRATIONS_DIR)

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if not tables:
        command.stamp(cfg, "base")
        command.upgrade(cfg, "head")
    elif "alembic_version" not in tables:
        command.stamp(cfg, "0001")
        command.upgrade(cfg, "head")
    else:
        command.upgrade(cfg, "head")


def init_db():
    import backend.models  # noqa: F401  ensure models registered
    from backend.seed import run_seed

    _run_alembic()
    with Session(engine) as session:
        run_seed(session)
