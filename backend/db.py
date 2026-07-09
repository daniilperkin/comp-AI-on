from sqlmodel import SQLModel, Session, create_engine

import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
SQLITE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


def get_session():
    with Session(engine) as session:
        yield session


def init_db():
    import backend.models  # noqa: F401  ensure models registered
    from backend.seed import run_seed

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        run_seed(session)
