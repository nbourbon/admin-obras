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
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # Receipt file
    receipt_file_path = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    contribution = relationship("Contribution", back_populates="payments")
    user = relationship("User", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])
