from datetime import datetime
from decimal import Decimal
from typing import Optional, Annotated
from pydantic import BaseModel, Field, EmailStr, model_validator


class CompositionMember(BaseModel):
    key: str = Field(min_length=1, max_length=100)
    user_id: Optional[int] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(default=None, max_length=255)
    percentage: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)

    @model_validator(mode='after')
    def identity(self):
        if (self.user_id is None) == (self.email is None):
            raise ValueError('Indicá un miembro existente o un email nuevo')
        if self.email and not (self.full_name and self.full_name.strip()):
            raise ValueError('Ingresá el nombre del nuevo miembro')
        return self


class ExternalSettlement(BaseModel):
    payer_key: str
    recipient_key: str
    amount: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    paid_at: datetime
    reference: str = Field(min_length=1, max_length=500)


class CompositionRequest(BaseModel):
    effective_at: datetime
    reason: str = Field(min_length=3, max_length=1000)
    exchange_rate: Optional[Annotated[Decimal, Field(gt=0, max_digits=15, decimal_places=4)]] = None
    members: list[CompositionMember] = Field(min_length=1, max_length=100)
    settlements: list[ExternalSettlement] = Field(default_factory=list, max_length=200)
    preview_token: Optional[str] = None
    request_key: Optional[str] = Field(default=None, min_length=1, max_length=100)
