from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ProjectMemberHistory(Base):
    __tablename__ = "project_member_history"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(20), nullable=False)  # "added", "updated", "removed"
    old_percentage = Column(Numeric(5, 2), nullable=True)
    new_percentage = Column(Numeric(5, 2), nullable=True)
    old_is_admin = Column(Boolean, nullable=True)
    new_is_admin = Column(Boolean, nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    member_user = relationship("User", foreign_keys=[user_id])
    changed_by_user = relationship("User", foreign_keys=[changed_by])
    project = relationship("Project")
