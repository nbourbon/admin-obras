from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ProviderBase(BaseModel):
    name: str
    contact_info: Optional[str] = None


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: Optional[bool] = None


class ProviderResponse(ProviderBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
