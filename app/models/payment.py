from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.expense import Currency


class ParticipantPayment(Base):
    __tablename__ = "participant_payments"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Amount due (based on participation %)
    amount_due_usd = Column(Numeric(15, 2), nullable=False)
    amount_due_ars = Column(Numeric(15, 2), nullable=False)

    # Payment info
    amount_paid = Column(Numeric(15, 2), nullable=True, default=0)
    currency_paid = Column(Enum(Currency), nullable=True)
    is_pending_approval = Column(Boolean, default=False)
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    # Approval info
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String(500), nullable=True)

    # Receipt file
    receipt_file_path = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    expense = relationship("Expense", back_populates="participant_payments")
    user = relationship("User", back_populates="payments", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])


class ExchangeRateLog(Base):
    __tablename__ = "exchange_rate_log"

    id = Column(Integer, primary_key=True, index=True)
    rate_usd_to_ars = Column(Numeric(15, 4), nullable=False)
    source = Column(String(255), nullable=False)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
