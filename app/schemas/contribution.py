from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime
from typing import Optional
from app.models.contribution import ContributionStatus, Currency


class ContributionBase(BaseModel):
    description: str
    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: Currency = Currency.ARS


class ContributionCreate(ContributionBase):
    pass


class ContributionResponse(ContributionBase):
    id: int
    project_id: int
    created_by: int
    status: ContributionStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ContributionWithDetails(ContributionResponse):
    """Contribution with creator info and payment stats"""
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    total_participants: int = 0
    paid_participants: int = 0

    class Config:
        from_attributes = True


class ContributionWithMyPayment(ContributionResponse):
    """Contribution with current user's payment info"""
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    my_amount_due: Decimal = Decimal("0")  # Cuánto debe pagar el usuario actual
    i_paid: bool = False  # Si el usuario actual ya pagó
    is_complete: bool = False  # Si todos los participantes pagaron
    total_participants: int = 0
    paid_participants: int = 0

    class Config:
        from_attributes = True


class ContributionPaymentDetail(BaseModel):
    """Details of a single contribution payment (for detail view)"""
    payment_id: int
    user_id: int
    user_name: str
    user_email: str
    amount_due: Decimal
    is_paid: bool
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContributionDetailResponse(ContributionResponse):
    """Full contribution details with all participants' payment status"""
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    payments: list[ContributionPaymentDetail] = []
    total_participants: int = 0
    paid_participants: int = 0
    is_complete: bool = False

    class Config:
        from_attributes = True


class MemberBalanceResponse(BaseModel):
    """Member balance for dashboard display"""
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
    """Total contributions by participant for pie chart"""
    user_id: int
    user_name: str
    user_email: str
    participation_percentage: Decimal
    total_usd: Decimal
    total_ars: Decimal
    contributions_count: int

    class Config:
        from_attributes = True
