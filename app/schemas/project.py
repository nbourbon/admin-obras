from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Optional, List


# Project Schemas
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    is_individual: bool = True  # New projects are individual (single-user) by default


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_individual: Optional[bool] = None
    is_active: Optional[bool] = None


class ProjectResponse(ProjectBase):
    id: int
    created_by: int
    is_individual: bool
    is_active: bool
    created_at: datetime
    current_user_is_admin: Optional[bool] = None  # Whether the current user is admin of this project

    class Config:
        from_attributes = True


# Project Member Schemas
class ProjectMemberBase(BaseModel):
    user_id: int
    participation_percentage: Decimal = Decimal("0")
    is_admin: bool = False


class ProjectMemberCreate(ProjectMemberBase):
    pass


class ProjectMemberUpdate(BaseModel):
    participation_percentage: Optional[Decimal] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class ProjectMemberResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    user_name: str
    user_email: str
    participation_percentage: Decimal
    is_admin: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectWithMembers(ProjectResponse):
    members: List[ProjectMemberResponse] = []
