from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional
from app.models.contribution import ContributionStatus
from app.models.expense import Currency


class ContributionCreate(BaseModel):
    """Schema for creating a new contribution."""
    amount_original: Decimal
    currency_original: Currency
    description: Optional[str] = None
    exchange_rate_override: Optional[Decimal] = None  # Manual TC override (DUAL mode)
    contribution_date: Optional[datetime] = None


class ContributionResponse(BaseModel):
    """Schema for contribution responses."""
    id: int
    project_id: int
    user_id: int
    amount_original: Decimal
    currency_original: Currency
    amount_usd: Decimal
    amount_ars: Decimal
    exchange_rate_used: Decimal
    exchange_rate_source: Optional[str] = None
    status: ContributionStatus
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    receipt_file_path: Optional[str] = None
    description: Optional[str] = None
    contribution_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContributionWithUser(ContributionResponse):
    """Schema for contribution with user details."""
    user_name: str
    user_email: str

    class Config:
        from_attributes = True


class ContributionRejection(BaseModel):
    """Schema for rejecting a contribution."""
    rejection_reason: str


class MemberBalanceResponse(BaseModel):
    """Schema for member balance information."""
    user_id: int
    user_name: str
    user_email: str
    participation_percentage: Decimal
    balance_usd: Decimal
    balance_ars: Decimal
    balance_updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContributionsByParticipant(BaseModel):
    """Schema for total contributions by participant."""
    user_id: int
    user_name: str
    user_email: str
    participation_percentage: Decimal
    total_usd: Decimal
    total_ars: Decimal
    contributions_count: int

    class Config:
        from_attributes = True
