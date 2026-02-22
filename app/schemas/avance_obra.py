from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from decimal import Decimal


class RubroInfo(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CategoryInfo(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class AvanceObraEntry(BaseModel):
    rubro_id: int
    category_id: Optional[int] = None
    percentage: Decimal = Field(ge=0, le=100)
    notes: Optional[str] = None


class AvanceObraResponse(BaseModel):
    id: int
    rubro: RubroInfo
    category: Optional[CategoryInfo] = None
    percentage: Decimal
    notes: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True
