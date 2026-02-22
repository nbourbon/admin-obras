from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from app.models.expense import Currency, ExpenseStatus
from app.schemas.provider import ProviderResponse
from app.schemas.category import CategoryResponse
from app.schemas.rubro import RubroResponse


class ExpenseBase(BaseModel):
    description: str
    amount_original: Decimal
    currency_original: Currency
    provider_id: Optional[int] = None
    category_id: Optional[int] = None
    rubro_id: Optional[int] = None
    expense_date: Optional[datetime] = None
    is_contribution: Optional[bool] = False  # True if this is a contribution request


class ExpenseCreate(ExpenseBase):
    exchange_rate_override: Optional[Decimal] = None  # Manual TC override (DUAL mode)


class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount_original: Optional[Decimal] = None
    currency_original: Optional[Currency] = None
    provider_id: Optional[int] = None
    category_id: Optional[int] = None
    rubro_id: Optional[int] = None
    expense_date: Optional[datetime] = None
    exchange_rate_override: Optional[Decimal] = None  # Manual TC override (DUAL mode)
    is_contribution: Optional[bool] = None


class ExpenseResponse(BaseModel):
    id: int
    description: str
    amount_original: Decimal
    currency_original: Currency
    amount_usd: Decimal
    amount_ars: Decimal
    exchange_rate_used: Decimal
    exchange_rate_source: Optional[str] = None
    provider_id: Optional[int] = None
    category_id: Optional[int] = None
    rubro_id: Optional[int] = None
    created_by: int
    invoice_file_path: Optional[str] = None
    status: ExpenseStatus
    is_contribution: bool = False
    expense_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_deleted: bool = False

    # Include related objects
    provider: Optional[ProviderResponse] = None
    category: Optional[CategoryResponse] = None
    rubro: Optional[RubroResponse] = None

    # Payment tracking (similar to Contributions)
    my_amount_due: Optional[Decimal] = None  # My share of this expense
    my_payment_id: Optional[int] = None  # My payment ID for this expense
    i_paid: bool = False  # Did I pay my share? (approved)
    is_pending_approval: bool = False  # Submitted but pending approval
    is_complete: bool = False  # Did everyone pay?
    paid_participants: int = 0  # How many participants paid
    total_participants: int = 0  # Total participants

    class Config:
        from_attributes = True


class PaymentSummary(BaseModel):
    user_id: int
    user_name: str
    amount_due_usd: Decimal
    amount_due_ars: Decimal
    is_paid: bool
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExpenseWithPayments(ExpenseResponse):
    participant_payments: List[PaymentSummary] = []
    total_paid_usd: Decimal = Decimal("0")
    total_pending_usd: Decimal = Decimal("0")
    total_actual_paid_usd: Optional[Decimal] = None  # Sum of amount_paid_usd from payments
    total_actual_paid_ars: Optional[Decimal] = None  # Sum of amount_paid_ars from payments
