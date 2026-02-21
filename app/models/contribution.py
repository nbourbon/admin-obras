from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.expense import Currency
import enum


class ContributionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Contribution(Base):
    __tablename__ = "contributions"

    # Identificación
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Montos dual currency (igual que Expense)
    amount_original = Column(Numeric(15, 2), nullable=False)
    currency_original = Column(Enum(Currency), nullable=False)

    # Computed amounts in both currencies
    amount_usd = Column(Numeric(15, 2), nullable=False, default=0)
    amount_ars = Column(Numeric(15, 2), nullable=False, default=0)

    # Exchange rate used for conversion
    exchange_rate_used = Column(Numeric(15, 4), nullable=False, default=1)

    # Exchange rate source: "auto" (API) or "manual" (override)
    exchange_rate_source = Column(String(50), nullable=True)

    # Estado y aprobación
    status = Column(Enum(ContributionStatus), default=ContributionStatus.PENDING, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Opcional
    receipt_file_path = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    # Timestamps
    contribution_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="contributions")
    user = relationship("User", back_populates="contributions", foreign_keys=[user_id])
    approved_by_user = relationship("User", foreign_keys=[approved_by])
