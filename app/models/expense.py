from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class Currency(str, enum.Enum):
    USD = "USD"
    ARS = "ARS"


class CurrencyMode(str, enum.Enum):
    ARS = "ARS"     # Solo pesos
    USD = "USD"     # Solo dólares
    DUAL = "DUAL"   # Doble moneda con tipo de cambio


class ExpenseStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(Text, nullable=False)

    # Original amount as entered
    amount_original = Column(Numeric(15, 2), nullable=False)
    currency_original = Column(Enum(Currency), nullable=False)

    # Computed amounts in both currencies
    amount_usd = Column(Numeric(15, 2), nullable=False)
    amount_ars = Column(Numeric(15, 2), nullable=False)

    # Exchange rate used for conversion
    exchange_rate_used = Column(Numeric(15, 4), nullable=False)

    # Exchange rate source: "auto" (API) or "manual" (override)
    exchange_rate_source = Column(String(50), nullable=True)

    # Foreign keys
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    # Invoice file
    invoice_file_path = Column(String(500), nullable=True)

    # Status
    status = Column(Enum(ExpenseStatus), default=ExpenseStatus.PENDING)

    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    expense_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    provider = relationship("Provider", back_populates="expenses")
    category = relationship("Category", back_populates="expenses")
    created_by_user = relationship("User", back_populates="expenses_created", foreign_keys=[created_by])
    participant_payments = relationship("ParticipantPayment", back_populates="expense", cascade="all, delete-orphan")
    project = relationship("Project", back_populates="expenses")
