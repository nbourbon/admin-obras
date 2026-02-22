from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ContributionPayment(Base):
    __tablename__ = "contribution_payments"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    contribution_id = Column(Integer, ForeignKey("contributions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Amount due (based on participation %)
    amount_due = Column(Numeric(15, 2), nullable=False)

    # Payment info
    amount_paid = Column(Numeric(15, 2), nullable=True, default=0)
    payment_date = Column(DateTime(timezone=True), nullable=True)  # Actual date of payment
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)  # When marked as paid in system
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    # Approval info (for non-individual projects)
    is_pending_approval = Column(Boolean, default=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String(500), nullable=True)

    # Receipt file
    receipt_file_path = Column(String(500), nullable=True)

    # Currency tracking at payment time (matching ParticipantPayment pattern)
    currency_paid = Column(String(3), nullable=True)  # "USD" or "ARS"
    exchange_rate_at_payment = Column(Numeric(10, 2), nullable=True)
    exchange_rate_source = Column(String(10), nullable=True)  # "auto" or "manual"
    amount_paid_usd = Column(Numeric(15, 2), nullable=True, default=0)
    amount_paid_ars = Column(Numeric(15, 2), nullable=True, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    contribution = relationship("Contribution", back_populates="payments")
    user = relationship("User", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])
