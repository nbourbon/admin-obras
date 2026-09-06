from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    is_admin: bool = False


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    auth_version: int = 0
    user_id: Optional[int] = None
    email: Optional[str] = None


class PasswordChange(BaseModel):
    new_password: str


class GoogleAuthRequest(BaseModel):
    token: str


class RegistrationRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)


class EmailRequest(BaseModel):
    email: EmailStr


class ActionRequest(BaseModel):
    token: str = Field(min_length=20, max_length=256)


class CompleteActionRequest(ActionRequest):
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if value is not None and (len(value) < 10 or len(value.encode("utf-8")) > 72):
            raise ValueError("Usá al menos 10 caracteres y como máximo 72 bytes para la contraseña")
        return value
