from sqlalchemy import Column, Integer, String, Boolean, Numeric, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    participation_percentage = Column(Numeric(5, 2), nullable=False, default=0)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    expenses_created = relationship("Expense", back_populates="created_by_user", foreign_keys="[Expense.created_by]")
    payments = relationship("ParticipantPayment", back_populates="user", foreign_keys="[ParticipantPayment.user_id]")
    projects_created = relationship("Project", back_populates="creator", foreign_keys="[Project.created_by]")
    project_memberships = relationship("ProjectMember", back_populates="user")
    # Note-related relationships
    notes_created = relationship("Note", back_populates="creator", foreign_keys="[Note.created_by]")
    note_participations = relationship("NoteParticipant", back_populates="user")
    note_comments = relationship("NoteComment", back_populates="user")
    user_votes = relationship("UserVote", back_populates="user")
