from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header, get_required_project, is_project_admin
from app.models.user import User
from app.models.category import Category
from app.models.project import Project

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
    include_inactive: bool = False,
):
    """
    List all categories for the current project.
    """
    query = db.query(Category)
    if project:
        query = query.filter(Category.project_id == project.id)
    if not include_inactive:
        query = query.filter(Category.is_active == True)
    return query.order_by(Category.name).all()


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
    # Check if category with same name exists in this project
    existing = db.query(Category).filter(
        Category.name == category_data.name,
        Category.project_id == project.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists in this project",
        )

    data = category_data.model_dump()
    data["project_id"] = project.id
    category = Category(**data)
    db.add(category)
    db.commit()
    db.refresh(category)
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
    category = db.query(Category).filter(Category.id == category_id).first()
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
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    # Verify user is admin of the category's project
    if category.project_id and not is_project_admin(db, current_user.id, category.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    # Check name uniqueness if updating name (within same project)
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
    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
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

    # Verify user is admin of the category's project
    if category.project_id and not is_project_admin(db, current_user.id, category.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    category.is_active = False
    db.commit()

    return {"message": "Category deactivated successfully"}
