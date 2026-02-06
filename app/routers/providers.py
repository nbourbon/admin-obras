from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.provider import ProviderCreate, ProviderUpdate, ProviderResponse
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header, get_required_project, is_project_admin
from app.models.user import User
from app.models.provider import Provider
from app.models.project import Project

router = APIRouter(prefix="/providers", tags=["Providers"])


@router.get("", response_model=List[ProviderResponse])
async def list_providers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
    include_inactive: bool = False,
):
    """
    List all providers for the current project.
    """
    query = db.query(Provider)
    if project:
        query = query.filter(Provider.project_id == project.id)
    if not include_inactive:
        query = query.filter(Provider.is_active == True)
    return query.order_by(Provider.name).all()


@router.post("", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    provider_data: ProviderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Project = Depends(get_required_project),
):
    """
    Create a new provider (project admin only).
    """
    data = provider_data.model_dump()
    data["project_id"] = project.id
    provider = Provider(**data)
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.get("/{provider_id}", response_model=ProviderResponse)
async def get_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific provider by ID.
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found",
        )
    return provider


@router.put("/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: int,
    provider_data: ProviderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a provider (project admin only).
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found",
        )

    # Verify user is admin of the provider's project
    if provider.project_id and not is_project_admin(db, current_user.id, provider.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    update_data = provider_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(provider, field, value)

    db.commit()
    db.refresh(provider)
    return provider


@router.delete("/{provider_id}")
async def deactivate_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deactivate a provider (project admin only).
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found",
        )

    # Verify user is admin of the provider's project
    if provider.project_id and not is_project_admin(db, current_user.id, provider.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    provider.is_active = False
    db.commit()

    return {"message": "Provider deactivated successfully"}
