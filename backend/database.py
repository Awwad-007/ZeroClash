from sqlmodel import create_engine, Session, SQLModel
from sqlalchemy import text
from backend.config import DATABASE_URL

# Connect args for SQLite (enable foreign keys and multi-thread connection)
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
