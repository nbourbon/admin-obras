"""Immutable accounting cutovers. Details use decimal strings, never JSON floats."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class CompositionChange(Base):
    __tablename__ = 'composition_changes'
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False, index=True)
    effective_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    request_key = Column(String(100), nullable=False)
    snapshot = Column(JSON, nullable=False)
    __table_args__ = (UniqueConstraint('project_id', 'request_key', name='uq_composition_request'),)
