from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ContributionAbsorption(Base):
    __tablename__ = "contribution_absorptions"

    id = Column(Integer, primary_key=True, index=True)

    # The formal request (solicitud) that absorbs the unilateral contribution
    solicitud_id = Column(Integer, ForeignKey("contributions.id"), nullable=False)
    # The unilateral contribution being absorbed
    unilateral_id = Column(Integer, ForeignKey("contributions.id"), nullable=False)
    # The user whose payment is being offset
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    amount_absorbed = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    solicitud = relationship("Contribution", foreign_keys=[solicitud_id])
    unilateral = relationship("Contribution", foreign_keys=[unilateral_id])
    user = relationship("User", foreign_keys=[user_id])
