from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header, get_required_project, is_project_admin
from app.models.user import User
from app.models.category import Category
from app.models.rubro import Rubro
from app.models.project import Project

router = APIRouter(prefix="/categories", tags=["Categories"])

_UNSET = object()


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
    include_inactive: bool = False,
    rubro_id: Optional[int] = None,
):
    """
    List all categories for the current project.
    If rubro_id is provided, returns generic categories (no rubros assigned)
    plus categories explicitly assigned to that rubro.
    """
    query = db.query(Category).options(joinedload(Category.rubros))
    if project:
        query = query.filter(Category.project_id == project.id)
    if not include_inactive:
        query = query.filter(Category.is_active == True)

    categories = query.order_by(Category.name).all()

    if rubro_id is not None:
        categories = [
            c for c in categories
            if len(c.rubros) == 0 or any(r.id == rubro_id for r in c.rubros)
        ]

    return categories


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Project = Depends(get_required_project),
):
    """
    Create a new category (project admin only).
    """
    existing = db.query(Category).filter(
        Category.name == category_data.name,
        Category.project_id == project.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists in this project",
        )

    data = category_data.model_dump(exclude={'rubro_ids'})
    data["project_id"] = project.id
    category = Category(**data)
    db.add(category)
    db.flush()

    if category_data.rubro_ids:
        rubros = db.query(Rubro).filter(Rubro.id.in_(category_data.rubro_ids)).all()
        category.rubros = rubros

    db.commit()
    db.refresh(category)
    # Reload with rubros eagerly
    db.expunge(category)
    category = db.query(Category).options(joinedload(Category.rubros)).filter(Category.id == category.id).first()
    return category


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific category by ID.
    """
    category = db.query(Category).options(joinedload(Category.rubros)).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a category (project admin only).
    """
    category = db.query(Category).options(joinedload(Category.rubros)).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    if category.project_id and not is_project_admin(db, current_user.id, category.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    if category_data.name and category_data.name != category.name:
        query = db.query(Category).filter(Category.name == category_data.name)
        if category.project_id:
            query = query.filter(Category.project_id == category.project_id)
        existing = query.first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category with this name already exists in this project",
            )

    update_data = category_data.model_dump(exclude_unset=True)
    rubro_ids = update_data.pop('rubro_ids', _UNSET)

    for field, value in update_data.items():
        setattr(category, field, value)

    if rubro_ids is not _UNSET and rubro_ids is not None:
        rubros = db.query(Rubro).filter(Rubro.id.in_(rubro_ids)).all() if rubro_ids else []
        category.rubros = rubros

    db.commit()
    db.refresh(category)
    db.expunge(category)
    category = db.query(Category).options(joinedload(Category.rubros)).filter(Category.id == category.id).first()
    return category


@router.delete("/{category_id}")
async def deactivate_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deactivate a category (project admin only).
    """
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    if category.project_id and not is_project_admin(db, current_user.id, category.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    category.is_active = False
    db.commit()

    return {"message": "Category deactivated successfully"}
