from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth import decode_token, get_user_by_id
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Get the current authenticated user."""
    token_data = decode_token(token)

    user = get_user_by_id(db, token_data.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current user and verify they are an admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_project_from_header(
    x_project_id: Optional[int] = Header(None, alias="X-Project-ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Optional[Project]:
    """
    Get project from X-Project-ID header and verify user is a member.
    Returns None if no project ID is provided.
    """
    if x_project_id is None:
        return None

    project = db.query(Project).filter(
        Project.id == x_project_id,
        Project.is_active == True
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check if user is a member of this project
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == x_project_id,
        ProjectMember.user_id == current_user.id,
        ProjectMember.is_active == True
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project",
        )

    return project


async def get_required_project(
    project: Optional[Project] = Depends(get_project_from_header),
) -> Project:
    """Get project from header, raising error if not provided."""
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )
    return project


async def get_project_admin_user(
    x_project_id: Optional[int] = Header(None, alias="X-Project-ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get current user and verify they are an admin of the specified project.
    Raises 403 if user is not an admin of the project.
    """
    if x_project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    project = db.query(Project).filter(
        Project.id == x_project_id,
        Project.is_active == True
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check if user is an admin of this project
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == x_project_id,
        ProjectMember.user_id == current_user.id,
        ProjectMember.is_active == True
    ).first()

    if not member or not member.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    return current_user


def is_project_admin(db: Session, user_id: int, project_id: int) -> bool:
    """
    Helper function to check if a user is an admin of a project.
    Returns True if the user is an admin of the project.
    """
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
        ProjectMember.is_active == True,
        ProjectMember.is_admin == True
    ).first()
    return member is not None
