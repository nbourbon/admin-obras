from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional
from app.models.expense import Currency


class PaymentBase(BaseModel):
    expense_id: int
    user_id: int
    amount_due_usd: Decimal
    amount_due_ars: Decimal


class PaymentResponse(PaymentBase):
    id: int
    amount_paid: Optional[Decimal] = None
    currency_paid: Optional[Currency] = None
    payment_date: Optional[datetime] = None
    is_pending_approval: bool = False
    is_paid: bool
    paid_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    receipt_file_path: Optional[str] = None
    exchange_rate_at_payment: Optional[Decimal] = None
    amount_paid_usd: Optional[Decimal] = None
    amount_paid_ars: Optional[Decimal] = None
    exchange_rate_source: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentMarkPaid(BaseModel):
    amount_paid: Decimal
    currency_paid: Currency
    payment_date: Optional[datetime] = None
    exchange_rate_override: Optional[Decimal] = None  # Manual TC override (DUAL mode)


class PaymentApproval(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None


class AdminMarkAllPaid(BaseModel):
    payment_date: Optional[datetime] = None
    exchange_rate_override: Optional[Decimal] = None
    currency: Optional[str] = None  # "USD" or "ARS" (for DUAL mode only)


class ExpenseInfo(BaseModel):
    id: int
    description: str
    amount_usd: Decimal
    amount_ars: Decimal
    expense_date: datetime
    provider_name: Optional[str] = None
    category_name: Optional[str] = None
    currency_mode: Optional[str] = None

    class Config:
        from_attributes = True


class UserInfo(BaseModel):
    id: int
    full_name: str
    email: str

    class Config:
        from_attributes = True


class PaymentWithExpense(PaymentResponse):
    expense: ExpenseInfo
    user: Optional[UserInfo] = None


class ContributionInfo(BaseModel):
    """Info about a contribution for payment display"""
    id: int
    description: str
    amount: Decimal
    currency: Currency
    created_at: datetime
    created_by_name: str

    class Config:
        from_attributes = True


class MyPaymentItem(BaseModel):
    """Unified payment item for both expense payments and contribution payments"""
    id: int
    payment_type: str  # "expense" or "contribution"
    description: str  # Expense or Contribution description
    amount_due: Decimal  # How much user needs to pay (in the payment's currency)
    currency: str  # "USD" or "ARS" - currency of the payment
    is_paid: bool
    paid_at: Optional[datetime] = None
    created_at: datetime

    # Optional fields for expense payments
    expense_id: Optional[int] = None
    provider_name: Optional[str] = None
    category_name: Optional[str] = None
    expense_date: Optional[datetime] = None

    # Optional fields for contribution payments
    contribution_id: Optional[int] = None
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True
