from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import List, Optional


class DashboardSummary(BaseModel):
    total_expenses_usd: Decimal
    total_expenses_ars: Decimal
    total_paid_usd: Decimal
    total_paid_ars: Decimal
    total_pending_usd: Decimal
    total_pending_ars: Decimal
    expenses_count: int
    participants_count: int
    current_exchange_rate: Decimal
    currency_mode: Optional[str] = None


class MonthlyExpense(BaseModel):
    year: int
    month: int
    total_usd: Decimal
    total_ars: Decimal
    expenses_count: int


class ExpenseEvolution(BaseModel):
    monthly_data: List[MonthlyExpense]
    cumulative_usd: Decimal
    cumulative_ars: Decimal


class UserPaymentStatus(BaseModel):
    user_id: int
    user_name: str
    participation_percentage: Decimal
    total_due_usd: Decimal
    total_due_ars: Decimal
    total_paid_usd: Decimal
    total_paid_ars: Decimal
    pending_usd: Decimal
    pending_ars: Decimal
    pending_payments_count: int


class ParticipantStatus(BaseModel):
    payment_id: int
    user_id: int
    user_name: str
    amount_due_usd: Decimal
    amount_due_ars: Decimal
    is_pending_approval: bool = False
    is_paid: bool
    paid_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    exchange_rate_at_payment: Optional[Decimal] = None
    amount_paid_usd: Optional[Decimal] = None
    amount_paid_ars: Optional[Decimal] = None


class ExpensePaymentStatus(BaseModel):
    expense_id: int
    description: str
    total_amount_usd: Decimal
    total_amount_ars: Decimal
    participants: List[ParticipantStatus]
    fully_paid: bool
    paid_count: int
    pending_count: int


class ExpenseByProvider(BaseModel):
    provider_id: Optional[int] = None
    provider_name: str
    total_usd: Decimal
    total_ars: Decimal
    expenses_count: int


class ExpenseByCategory(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    total_usd: Decimal
    total_ars: Decimal
    expenses_count: int
