import os

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
SQLITE_URL = f"sqlite:///{DB_PATH}"

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


def init_db():
    import backend.models  # noqa: F401  ensure models registered
    from backend.seed import run_seed

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        run_seed(session)
