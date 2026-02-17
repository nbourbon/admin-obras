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
    from app.models import (  # noqa: F401
        User,
        Provider,
        Category,
        Expense,
        ParticipantPayment,
        ExchangeRateLog,
        Project,
        ProjectMember,
        ProjectMemberHistory,
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

    # Migration: Add is_admin to project_members table
    if 'project_members' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('project_members')]
        if 'is_admin' not in columns:
            with engine.connect() as conn:
                try:
                    # Add is_admin column with default FALSE
                    conn.execute(text('ALTER TABLE project_members ADD COLUMN is_admin BOOLEAN DEFAULT FALSE'))
                    conn.commit()
                    print("Migration: Added is_admin column to project_members table")

                    # Set is_admin=TRUE for members who are also the project creator
                    conn.execute(text('''
                        UPDATE project_members
                        SET is_admin = TRUE
                        WHERE user_id IN (
                            SELECT created_by FROM projects WHERE projects.id = project_members.project_id
                        )
                    '''))
                    conn.commit()
                    print("Migration: Set is_admin=TRUE for project creators")
                except Exception as e:
                    print(f"Migration warning (is_admin): {e}")

    # Migration: Add soft delete columns to expenses table
    if 'expenses' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('expenses')]
        if 'is_deleted' not in columns:
            with engine.connect() as conn:
                try:
                    conn.execute(text('ALTER TABLE expenses ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL'))
                    conn.execute(text('ALTER TABLE expenses ADD COLUMN deleted_at TIMESTAMP'))
                    conn.execute(text('ALTER TABLE expenses ADD COLUMN deleted_by INTEGER'))
                    conn.commit()
                    print("Migration: Added soft delete columns to expenses table")
                except Exception as e:
                    print(f"Migration warning (expenses soft delete): {e}")

    # Migration: Add soft delete columns to participant_payments table
    if 'participant_payments' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('participant_payments')]
        if 'is_deleted' not in columns:
            with engine.connect() as conn:
                try:
                    conn.execute(text('ALTER TABLE participant_payments ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL'))
                    conn.execute(text('ALTER TABLE participant_payments ADD COLUMN deleted_at TIMESTAMP'))
                    conn.execute(text('ALTER TABLE participant_payments ADD COLUMN deleted_by INTEGER'))
                    conn.commit()
                    print("Migration: Added soft delete columns to participant_payments table")
                except Exception as e:
                    print(f"Migration warning (participant_payments soft delete): {e}")

    # Migration: Add payment_date to participant_payments table
    if 'participant_payments' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('participant_payments')]
        if 'payment_date' not in columns:
            with engine.connect() as conn:
                try:
                    conn.execute(text('ALTER TABLE participant_payments ADD COLUMN payment_date TIMESTAMP'))
                    conn.commit()
                    print("Migration: Added payment_date column to participant_payments table")
                except Exception as e:
                    print(f"Migration warning (payment_date): {e}")

    # Migration: Add currency_mode to projects table
    if 'projects' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('projects')]
        if 'currency_mode' not in columns:
            with engine.connect() as conn:
                try:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN currency_mode VARCHAR(10) DEFAULT 'DUAL'"))
                    conn.commit()
                    print("Migration: Added currency_mode column to projects table")
                except Exception as e:
                    print(f"Migration warning (currency_mode): {e}")

    # Migration: Add exchange_rate_source to expenses table
    if 'expenses' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('expenses')]
        if 'exchange_rate_source' not in columns:
            with engine.connect() as conn:
                try:
                    conn.execute(text('ALTER TABLE expenses ADD COLUMN exchange_rate_source VARCHAR(50)'))
                    conn.commit()
                    print("Migration: Added exchange_rate_source column to expenses table")
                except Exception as e:
                    print(f"Migration warning (exchange_rate_source): {e}")

    # Migration: Add exchange rate tracking columns to participant_payments table
    if 'participant_payments' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('participant_payments')]
        if 'exchange_rate_at_payment' not in columns:
            with engine.connect() as conn:
                try:
                    conn.execute(text('ALTER TABLE participant_payments ADD COLUMN exchange_rate_at_payment NUMERIC(15,4)'))
                    conn.execute(text('ALTER TABLE participant_payments ADD COLUMN amount_paid_usd NUMERIC(15,2)'))
                    conn.execute(text('ALTER TABLE participant_payments ADD COLUMN amount_paid_ars NUMERIC(15,2)'))
                    conn.execute(text('ALTER TABLE participant_payments ADD COLUMN exchange_rate_source VARCHAR(50)'))
                    conn.commit()
                    print("Migration: Added exchange rate tracking columns to participant_payments table")
                except Exception as e:
                    print(f"Migration warning (payment exchange rate): {e}")

    # Migration: Add google_id to users table + make password_hash nullable
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'google_id' not in columns:
            with engine.connect() as conn:
                try:
                    conn.execute(text('ALTER TABLE users ADD COLUMN google_id VARCHAR(255)'))
                    conn.commit()
                    print("Migration: Added google_id column to users table")
                except Exception as e:
                    print(f"Migration warning (google_id): {e}")

        # Make password_hash nullable for Google-only users (safe to run multiple times)
        with engine.connect() as conn:
            try:
                conn.execute(text('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL'))
                conn.commit()
                print("Migration: Made password_hash nullable in users table")
            except Exception:
                pass  # Already nullable, nothing to do

    # Migration: Update single-member projects to 100% participation
    if 'project_members' in inspector.get_table_names():
        with engine.connect() as conn:
            try:
                # For individual projects with only one member, set that member to 100%
                conn.execute(text('''
                    UPDATE project_members
                    SET participation_percentage = 100
                    WHERE project_id IN (
                        SELECT p.id FROM projects p
                        WHERE p.is_individual = TRUE
                        AND (
                            SELECT COUNT(*) FROM project_members pm
                            WHERE pm.project_id = p.id AND pm.is_active = TRUE
                        ) = 1
                    )
                    AND is_active = TRUE
                    AND participation_percentage != 100
                '''))
                conn.commit()
                print("Migration: Updated single-member individual projects to 100% participation")
            except Exception as e:
                print(f"Migration warning (single-member projects): {e}")
