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

    # Flags
    is_adjustment = Column(Boolean, default=False, nullable=False)
    is_unilateral = Column(Boolean, default=False, nullable=False)  # Direct contribution (vs formal request)

    # Unilateral contribution fields
    contributor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Who contributed
    absorbed_amount = Column(Numeric(15, 2), default=0, nullable=False)  # How much absorbed by formal requests
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)  # If created from expense screen

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="contributions")
    created_by_user = relationship("User", foreign_keys=[created_by])
    contributor_user = relationship("User", foreign_keys=[contributor_user_id])
    expense = relationship("Expense", foreign_keys=[expense_id])
    payments = relationship("ContributionPayment", back_populates="contribution", cascade="all, delete-orphan")
