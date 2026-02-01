from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class VoteOption(Base):
    __tablename__ = "vote_options"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    option_text = Column(String(500), nullable=False)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    note = relationship("Note", back_populates="vote_options")
    votes = relationship("UserVote", back_populates="vote_option", cascade="all, delete-orphan")


class UserVote(Base):
    __tablename__ = "user_votes"

    id = Column(Integer, primary_key=True, index=True)
    vote_option_id = Column(Integer, ForeignKey("vote_options.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    voted_at = Column(DateTime(timezone=True), server_default=func.now())

    # Unique constraint: one vote per user per note (enforced at application level via note_id)
    __table_args__ = (
        UniqueConstraint('vote_option_id', 'user_id', name='unique_user_vote_per_option'),
    )

    # Relationships
    vote_option = relationship("VoteOption", back_populates="votes")
    user = relationship("User", back_populates="user_votes")
