from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL

# SQLite specific connect args
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    
    # Ensure grade11_subject_ids and grade12_subject_ids columns exist in SQLite exam_sessions table
    from sqlalchemy import text
    with engine.connect() as conn:
        for col in ["grade11_subject_ids", "grade12_subject_ids"]:
            try:
                conn.execute(text(f"ALTER TABLE exam_sessions ADD COLUMN {col} TEXT DEFAULT ''"))
                conn.commit()
            except Exception:
                pass
