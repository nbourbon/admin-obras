from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ContributionStatus(str, enum.Enum):
    PENDING = "pending"    # Waiting for admin approval
    APPROVED = "approved"  # Approved, balance credited
    REJECTED = "rejected"  # Rejected, no balance credit


class Currency(str, enum.Enum):
    ARS = "ARS"
    USD = "USD"


class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(Text, nullable=False)

    # Amount and currency (generic, ready for multi-currency support)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(Enum(Currency), nullable=False, default=Currency.ARS)

    # Foreign keys
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Status
    status = Column(Enum(ContributionStatus), default=ContributionStatus.PENDING, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="contributions")
    created_by_user = relationship("User", foreign_keys=[created_by])
    payments = relationship("ContributionPayment", back_populates="contribution", cascade="all, delete-orphan")
