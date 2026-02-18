import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class NoteType(str, enum.Enum):
    REUNION = "reunion"          # Meeting minutes: participants + meeting_date
    NOTIFICACION = "notificacion"  # Notification: no participants needed
    VOTACION = "votacion"        # Voting: vote options + weighted results
    # Legacy values kept for backwards compatibility
    REGULAR = "regular"
    VOTING = "voting"


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    note_type = Column(Enum(NoteType), default=NoteType.REUNION)
    meeting_date = Column(DateTime(timezone=True), nullable=True)  # For reunion notes
    voting_description = Column(Text, nullable=True)  # For votacion notes
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="notes")
    creator = relationship("User", back_populates="notes_created", foreign_keys=[created_by])
    participants = relationship("NoteParticipant", back_populates="note", cascade="all, delete-orphan")
    comments = relationship("NoteComment", back_populates="note", cascade="all, delete-orphan")
    vote_options = relationship("VoteOption", back_populates="note", cascade="all, delete-orphan")


class NoteParticipant(Base):
    __tablename__ = "note_participants"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    note = relationship("Note", back_populates="participants")
    user = relationship("User", back_populates="note_participations")
