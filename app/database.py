from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings

settings = get_settings()

# Create engine - for SQLite we need check_same_thread=False
connect_args = {}
database_url = settings.database_url

if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif database_url.startswith("postgresql://"):
    # Use psycopg3 driver explicitly
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(
    database_url,
    connect_args=connect_args,
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from app.models import (
        User,
        Provider,
        Category,
        Expense,
        ParticipantPayment,
        ExchangeRateLog,
        Project,
        ProjectMember,
        Note,
        NoteParticipant,
        NoteComment,
        VoteOption,
        UserVote,
    )
    Base.metadata.create_all(bind=engine)

    # Run migrations for new columns on existing tables
    _run_migrations()


def _run_migrations():
    """Add new columns to existing tables if they don't exist."""
    from sqlalchemy import text, inspect

    inspector = inspect(engine)

    # Migration: Add is_individual to projects table
    if 'projects' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('projects')]
        if 'is_individual' not in columns:
            with engine.connect() as conn:
                try:
                    # Use FALSE for PostgreSQL compatibility (also works with SQLite)
                    conn.execute(text('ALTER TABLE projects ADD COLUMN is_individual BOOLEAN DEFAULT FALSE'))
                    conn.commit()
                    print("Migration: Added is_individual column to projects table")
                except Exception as e:
                    print(f"Migration warning (is_individual): {e}")
