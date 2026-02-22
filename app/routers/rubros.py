from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.rubro import RubroCreate, RubroUpdate, RubroResponse
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header, get_required_project, is_project_admin
from app.models.user import User
from app.models.rubro import Rubro
from app.models.project import Project

router = APIRouter(prefix="/rubros", tags=["Rubros"])


@router.get("", response_model=List[RubroResponse])
async def list_rubros(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
    include_inactive: bool = False,
):
    """
    List all rubros for the current project.
    """
    query = db.query(Rubro)
    if project:
        query = query.filter(Rubro.project_id == project.id)
    if not include_inactive:
        query = query.filter(Rubro.is_active == True)
    return query.order_by(Rubro.name).all()


@router.post("", response_model=RubroResponse, status_code=status.HTTP_201_CREATED)
async def create_rubro(
    rubro_data: RubroCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Project = Depends(get_required_project),
):
    """
    Create a new rubro (project admin only).
    """
    # Check if rubro with same name exists in this project
    existing = db.query(Rubro).filter(
        Rubro.name == rubro_data.name,
        Rubro.project_id == project.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rubro with this name already exists in this project",
        )

    data = rubro_data.model_dump()
    data["project_id"] = project.id
    rubro = Rubro(**data)
    db.add(rubro)
    db.commit()
    db.refresh(rubro)
    return rubro


@router.get("/{rubro_id}", response_model=RubroResponse)
async def get_rubro(
    rubro_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific rubro by ID.
    """
    rubro = db.query(Rubro).filter(Rubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubro not found",
        )
    return rubro


@router.put("/{rubro_id}", response_model=RubroResponse)
async def update_rubro(
    rubro_id: int,
    rubro_data: RubroUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a rubro (project admin only).
    """
    rubro = db.query(Rubro).filter(Rubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubro not found",
        )

    # Verify user is admin of the rubro's project
    if rubro.project_id and not is_project_admin(db, current_user.id, rubro.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    # Check name uniqueness if updating name (within same project)
    if rubro_data.name and rubro_data.name != rubro.name:
        query = db.query(Rubro).filter(Rubro.name == rubro_data.name)
        if rubro.project_id:
            query = query.filter(Rubro.project_id == rubro.project_id)
        existing = query.first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rubro with this name already exists in this project",
            )

    update_data = rubro_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rubro, field, value)

    db.commit()
    db.refresh(rubro)
    return rubro


@router.delete("/{rubro_id}")
async def deactivate_rubro(
    rubro_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deactivate a rubro (project admin only).
    """
    rubro = db.query(Rubro).filter(Rubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubro not found",
        )

    # Verify user is admin of the rubro's project
    if rubro.project_id and not is_project_admin(db, current_user.id, rubro.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    rubro.is_active = False
    db.commit()

    return {"message": "Rubro deactivated successfully"}
