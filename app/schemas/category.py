from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class RubroInfo(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class CategoryCreate(CategoryBase):
    rubro_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    rubro_id: Optional[int] = None


class CategoryResponse(CategoryBase):
    id: int
    is_active: bool
    created_at: datetime
    rubro: Optional[RubroInfo] = None

    class Config:
        from_attributes = True
