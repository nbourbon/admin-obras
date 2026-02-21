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

# Pool configuration for production (PostgreSQL)
pool_settings = {}
if not database_url.startswith("sqlite"):
    pool_settings = {
        "pool_size": 5,          # Keep 5 connections ready
        "max_overflow": 10,      # Allow up to 15 total connections
        "pool_pre_ping": True,   # Test connections before use (important for remote DB)
        "pool_recycle": 3600,    # Recycle connections after 1 hour
    }

engine = create_engine(
    database_url,
    connect_args=connect_args,
    echo=settings.debug,
    **pool_settings,
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
        Contribution,
    )
    Base.metadata.create_all(bind=engine)

    # Run migrations for new columns on existing tables
    _run_migrations()


def _run_migrations():
    """Add new columns to existing tables if they don't exist.

    Optimized to minimize DB round-trips: reads column info once per table,
    skips migrations that already ran, and uses a single connection.
    """
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    # Cache column info per table (single DB query each)
    def get_cols(table):
        if table not in table_names:
            return {}
        return {col['name']: col for col in inspector.get_columns(table)}

    projects_cols = get_cols('projects')
    members_cols = get_cols('project_members')
    expenses_cols = get_cols('expenses')
    payments_cols = get_cols('participant_payments')
    notes_cols = get_cols('notes')
    users_cols = get_cols('users')

    # Collect all pending migrations, then execute in a single connection
    pending = []

    # --- Projects table ---
    if projects_cols:
        if 'is_individual' not in projects_cols:
            pending.append(('ALTER TABLE projects ADD COLUMN is_individual BOOLEAN DEFAULT FALSE',
                            'Added is_individual to projects'))
        if 'currency_mode' not in projects_cols:
            pending.append(("ALTER TABLE projects ADD COLUMN currency_mode VARCHAR(10) DEFAULT 'DUAL'",
                            'Added currency_mode to projects'))

    # --- Project members table ---
    if members_cols:
        if 'is_admin' not in members_cols:
            pending.append(('ALTER TABLE project_members ADD COLUMN is_admin BOOLEAN DEFAULT FALSE',
                            'Added is_admin to project_members'))
            pending.append(('''
                UPDATE project_members SET is_admin = TRUE
                WHERE user_id IN (
                    SELECT created_by FROM projects WHERE projects.id = project_members.project_id
                )
            ''', 'Set is_admin=TRUE for project creators'))
        if 'balance_usd' not in members_cols:
            pending.append(('ALTER TABLE project_members ADD COLUMN balance_usd NUMERIC(15,2) DEFAULT 0 NOT NULL',
                            'Added balance_usd to project_members'))
        if 'balance_ars' not in members_cols:
            pending.append(('ALTER TABLE project_members ADD COLUMN balance_ars NUMERIC(15,2) DEFAULT 0 NOT NULL',
                            'Added balance_ars to project_members'))
        if 'balance_updated_at' not in members_cols:
            pending.append(('ALTER TABLE project_members ADD COLUMN balance_updated_at TIMESTAMP',
                            'Added balance_updated_at to project_members'))

    # --- Expenses table ---
    if expenses_cols:
        if 'is_deleted' not in expenses_cols:
            pending.append(('ALTER TABLE expenses ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL',
                            'Added is_deleted to expenses'))
            pending.append(('ALTER TABLE expenses ADD COLUMN deleted_at TIMESTAMP',
                            'Added deleted_at to expenses'))
            pending.append(('ALTER TABLE expenses ADD COLUMN deleted_by INTEGER',
                            'Added deleted_by to expenses'))
        if 'exchange_rate_source' not in expenses_cols:
            pending.append(('ALTER TABLE expenses ADD COLUMN exchange_rate_source VARCHAR(50)',
                            'Added exchange_rate_source to expenses'))
        if 'is_contribution' not in expenses_cols:
            pending.append(('ALTER TABLE expenses ADD COLUMN is_contribution BOOLEAN DEFAULT FALSE NOT NULL',
                            'Added is_contribution to expenses'))
        # Make provider_id and category_id nullable (needed for contributions which don't have these)
        provider_id_col = expenses_cols.get('provider_id')
        if provider_id_col and not provider_id_col.get('nullable', True):
            pending.append(('ALTER TABLE expenses ALTER COLUMN provider_id DROP NOT NULL',
                            'Made provider_id nullable'))
        category_id_col = expenses_cols.get('category_id')
        if category_id_col and not category_id_col.get('nullable', True):
            pending.append(('ALTER TABLE expenses ALTER COLUMN category_id DROP NOT NULL',
                            'Made category_id nullable'))

    # --- Participant payments table ---
    if payments_cols:
        if 'is_deleted' not in payments_cols:
            pending.append(('ALTER TABLE participant_payments ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL',
                            'Added is_deleted to participant_payments'))
            pending.append(('ALTER TABLE participant_payments ADD COLUMN deleted_at TIMESTAMP',
                            'Added deleted_at to participant_payments'))
            pending.append(('ALTER TABLE participant_payments ADD COLUMN deleted_by INTEGER',
                            'Added deleted_by to participant_payments'))
        if 'payment_date' not in payments_cols:
            pending.append(('ALTER TABLE participant_payments ADD COLUMN payment_date TIMESTAMP',
                            'Added payment_date to participant_payments'))
        if 'exchange_rate_at_payment' not in payments_cols:
            pending.append(('ALTER TABLE participant_payments ADD COLUMN exchange_rate_at_payment NUMERIC(15,4)',
                            'Added exchange_rate_at_payment to participant_payments'))
            pending.append(('ALTER TABLE participant_payments ADD COLUMN amount_paid_usd NUMERIC(15,2)',
                            'Added amount_paid_usd to participant_payments'))
            pending.append(('ALTER TABLE participant_payments ADD COLUMN amount_paid_ars NUMERIC(15,2)',
                            'Added amount_paid_ars to participant_payments'))
            pending.append(('ALTER TABLE participant_payments ADD COLUMN exchange_rate_source VARCHAR(50)',
                            'Added exchange_rate_source to participant_payments'))
        # Add contribution_id column for contribution payments
        if 'contribution_id' not in payments_cols:
            pending.append(('ALTER TABLE participant_payments ADD COLUMN contribution_id INTEGER REFERENCES contributions(id)',
                            'Added contribution_id to participant_payments'))
        # Make expense_id nullable (payment can be for expense OR contribution)
        expense_id_col = payments_cols.get('expense_id')
        if expense_id_col and not expense_id_col.get('nullable', True):
            pending.append(('ALTER TABLE participant_payments ALTER COLUMN expense_id DROP NOT NULL',
                            'Made expense_id nullable for contribution payments'))

    # --- Notes table ---
    if notes_cols:
        if 'meeting_date' not in notes_cols:
            pending.append(('ALTER TABLE notes ADD COLUMN meeting_date TIMESTAMP WITH TIME ZONE',
                            'Added meeting_date to notes'))
        if 'voting_closes_at' not in notes_cols:
            pending.append(('ALTER TABLE notes ADD COLUMN voting_closes_at TIMESTAMP WITH TIME ZONE',
                            'Added voting_closes_at to notes'))
            pending.append(('ALTER TABLE notes ADD COLUMN is_voting_closed BOOLEAN DEFAULT FALSE',
                            'Added is_voting_closed to notes'))

        # Convert note_type from PostgreSQL enum to VARCHAR (one-time migration)
        if not database_url.startswith("sqlite"):
            note_type_col = notes_cols.get('note_type')
            if note_type_col and 'varchar' not in str(note_type_col['type']).lower():
                # First normalize enum values, then convert to VARCHAR
                for val in ['reunion', 'notificacion', 'votacion']:
                    pending.append((f"ALTER TYPE notetype ADD VALUE IF NOT EXISTS '{val}'",
                                    f'Added enum value {val}'))
                pending.append(("UPDATE notes SET note_type = 'reunion' WHERE note_type::text IN ('regular', 'REGULAR', 'REUNION')",
                                'Normalized reunion note types'))
                pending.append(("UPDATE notes SET note_type = 'votacion' WHERE note_type::text IN ('voting', 'VOTING', 'VOTACION')",
                                'Normalized votacion note types'))
                pending.append(("UPDATE notes SET note_type = 'notificacion' WHERE note_type::text = 'NOTIFICACION'",
                                'Normalized notificacion note types'))
                pending.append(("ALTER TABLE notes ALTER COLUMN note_type TYPE VARCHAR(50) USING note_type::text",
                                'Converted note_type to VARCHAR'))

    # --- Users table ---
    if users_cols:
        if 'google_id' not in users_cols:
            pending.append(('ALTER TABLE users ADD COLUMN google_id VARCHAR(255)',
                            'Added google_id to users'))
        password_hash_col = users_cols.get('password_hash')
        if password_hash_col and not password_hash_col.get('nullable', True):
            pending.append(('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL',
                            'Made password_hash nullable'))

    # Execute all pending migrations
    if not pending:
        print("Migrations: All up to date (0 queries)")
        return

    print(f"Migrations: Running {len(pending)} pending migration(s)...")
    with engine.connect() as conn:
        for sql, description in pending:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"  Migration: {description}")
            except Exception as e:
                conn.rollback()
                print(f"  Migration warning ({description}): {e}")
    print("Migrations: Complete")
