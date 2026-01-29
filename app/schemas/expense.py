from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from app.models.expense import Currency, ExpenseStatus
from app.schemas.provider import ProviderResponse
from app.schemas.category import CategoryResponse


class ExpenseBase(BaseModel):
    description: str
    amount_original: Decimal
    currency_original: Currency
    provider_id: int
    category_id: int
    expense_date: Optional[datetime] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount_original: Optional[Decimal] = None
    currency_original: Optional[Currency] = None
    provider_id: Optional[int] = None
    category_id: Optional[int] = None
    expense_date: Optional[datetime] = None


class ExpenseResponse(BaseModel):
    id: int
    description: str
    amount_original: Decimal
    currency_original: Currency
    amount_usd: Decimal
    amount_ars: Decimal
    exchange_rate_used: Decimal
    provider_id: int
    category_id: int
    created_by: int
    invoice_file_path: Optional[str] = None
    status: ExpenseStatus
    expense_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Include related objects
    provider: Optional[ProviderResponse] = None
    category: Optional[CategoryResponse] = None

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
