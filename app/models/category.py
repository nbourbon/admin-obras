from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# Association table kept for backward compatibility (DB table still exists)
category_rubros = Table(
    'category_rubros',
    Base.metadata,
    Column('category_id', Integer, ForeignKey('categories.id'), primary_key=True),
    Column('rubro_id', Integer, ForeignKey('rubros.id'), primary_key=True),
)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True, default=None)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    rubro_id = Column(Integer, ForeignKey("rubros.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    expenses = relationship("Expense", back_populates="category")
    project = relationship("Project", back_populates="categories")
    rubro = relationship("Rubro", back_populates="categories", foreign_keys=[rubro_id])
