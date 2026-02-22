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
    # Contribution totals
    total_contributions_usd: Optional[Decimal] = Decimal("0")
    total_contributions_ars: Optional[Decimal] = Decimal("0")
    total_balance_usd: Optional[Decimal] = Decimal("0")
    total_balance_ars: Optional[Decimal] = Decimal("0")
    # Construction project fields
    project_type: Optional[str] = None
    square_meters: Optional[Decimal] = None
    cost_per_square_meter_usd: Optional[Decimal] = None
    cost_per_square_meter_ars: Optional[Decimal] = None
    contribution_mode: Optional[str] = None  # both, current_account, direct_payment


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
    # User's contribution balance
    balance_aportes_usd: Optional[Decimal] = Decimal("0")
    balance_aportes_ars: Optional[Decimal] = Decimal("0")
    has_pending_contribution: bool = False


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
    receipt_file_path: Optional[str] = None


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
