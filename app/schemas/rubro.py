from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class RubroBase(BaseModel):
    name: str
    description: Optional[str] = None


class RubroCreate(RubroBase):
    pass


class RubroUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RubroResponse(RubroBase):
    id: int
    project_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
