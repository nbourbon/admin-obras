from sqlalchemy import Column, Integer, Numeric, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AvanceObra(Base):
    __tablename__ = "avance_obra"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    rubro_id = Column(Integer, ForeignKey("rubros.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    percentage = Column(Numeric(5, 2), nullable=False)
    notes = Column(Text, nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    project = relationship("Project", back_populates="avances_obra")
    rubro = relationship("Rubro")
    category = relationship("Category")
    updater = relationship("User")
