from sqlmodel import create_engine, Session, SQLModel
from sqlalchemy import text
from backend.config import DATABASE_URL

# Connect args for SQLite (enable foreign keys and multi-thread connection)
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine_kwargs = {
    "echo": False,
    "connect_args": connect_args
}

if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL:
    engine_kwargs.update({
        "pool_size": 25,
        "max_overflow": 15,
        "pool_pre_ping": True,
    })

engine = create_engine(
    DATABASE_URL,
    **engine_kwargs
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def is_postgres_session(session: Session) -> bool:
    try:
        bind = session.get_bind()
        if bind is not None and bind.dialect.name == "postgresql":
            return True
    except Exception:
        pass
    return "postgres" in DATABASE_URL.lower()

def get_session():
    with Session(engine) as session:
        yield session
