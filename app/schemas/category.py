from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class RubroInfo(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None  # Hex color like #FF5733


class CategoryCreate(CategoryBase):
    rubro_ids: List[int] = []


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    rubro_ids: Optional[List[int]] = None  # None = no cambiar, [] = hacer genérica


class CategoryResponse(CategoryBase):
    id: int
    is_active: bool
    created_at: datetime
    rubros: List[RubroInfo] = []

    class Config:
        from_attributes = True
