from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ProjectType(str, enum.Enum):
    GENERICO = "generico"
    CONSTRUCCION = "construccion"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_individual = Column(Boolean, default=True)  # New projects are individual by default
    currency_mode = Column(String(10), default="DUAL")  # ARS, USD, or DUAL
    project_type = Column(String(20), default="generico", nullable=False)  # Use String, Pydantic validates
    type_parameters = Column(JSON, nullable=True)  # Flexible parameters per project type (e.g., {"square_meters": 150.5})
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    creator = relationship("User", back_populates="projects_created", foreign_keys=[created_by])
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    providers = relationship("Provider", back_populates="project")
    categories = relationship("Category", back_populates="project")
    rubros = relationship("Rubro", back_populates="project")
    expenses = relationship("Expense", back_populates="project")
    notes = relationship("Note", back_populates="project", cascade="all, delete-orphan")
    contributions = relationship("Contribution", back_populates="project", cascade="all, delete-orphan")
