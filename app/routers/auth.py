from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserCreate, UserResponse, Token
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
)
from app.utils.dependencies import get_current_user, get_current_admin_user
from app.models.user import User
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    Register a new participant (admin only).
    """
    user = create_user(
        db=db,
        email=user_data.email,
        password=user_data.password,
        full_name=user_data.full_name,
        participation_percentage=float(user_data.participation_percentage),
        is_admin=user_data.is_admin,
    )
    return user


@router.post("/register-first-admin", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_first_admin(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Register the first admin user (only works if no users exist).
    """
    # Check if any users exist
    existing_users = db.query(User).first()
    if existing_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Users already exist. Use /auth/register with admin credentials.",
        )

    user = create_user(
        db=db,
        email=user_data.email,
        password=user_data.password,
        full_name=user_data.full_name,
        participation_percentage=float(user_data.participation_percentage),
        is_admin=True,  # Force admin for first user
    )
    return user


@router.post("/self-register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def self_register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Self-register as a new admin user (no authentication required).
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = create_user(
        db=db,
        email=user_data.email,
        password=user_data.password,
        full_name=user_data.full_name,
        participation_percentage=0,  # No participation by default
        is_admin=True,  # All self-registered users are admins
    )
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Login and get access token.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email},
        expires_delta=access_token_expires,
    )
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """
    Get current user information.
    """
    return current_user
