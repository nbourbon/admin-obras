from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.avance_obra import AvanceObraEntry, AvanceObraResponse
from app.utils.dependencies import (
    get_current_user,
    get_project_admin_user,
    get_required_project,
)
from app.models.user import User
from app.models.project import Project
from app.models.avance_obra import AvanceObra
from app.models.rubro import Rubro
from app.models.category import Category

router = APIRouter(prefix="/avance-obra", tags=["Avance de Obra"])


@router.get("", response_model=List[AvanceObraResponse])
async def list_avance_obra(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Project = Depends(get_required_project),
):
    """List all avance de obra entries for the current project."""
    entries = (
        db.query(AvanceObra)
        .options(joinedload(AvanceObra.rubro), joinedload(AvanceObra.category))
        .filter(AvanceObra.project_id == project.id)
        .order_by(AvanceObra.rubro_id, AvanceObra.category_id)
        .all()
    )
    return entries


@router.put("", response_model=List[AvanceObraResponse])
async def save_avance_obra(
    entries: List[AvanceObraEntry],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Project = Depends(get_required_project),
):
    """Replace all avance de obra entries for the current project (admin only)."""
    keys = [(entry.rubro_id, entry.category_id) for entry in entries]
    if len(keys) != len(set(keys)):
        raise HTTPException(status_code=422, detail="Hay filas de avance repetidas")

    rubro_ids = {entry.rubro_id for entry in entries}
    valid_rubros = {
        row.id for row in db.query(Rubro).filter(
            Rubro.project_id == project.id,
            Rubro.id.in_(rubro_ids),
            Rubro.is_active == True,
        ).all()
    } if rubro_ids else set()
    if valid_rubros != rubro_ids:
        raise HTTPException(status_code=422, detail="Uno de los rubros no pertenece al proyecto")

    category_ids = {entry.category_id for entry in entries if entry.category_id is not None}
    categories = db.query(Category).filter(
        Category.project_id == project.id,
        Category.id.in_(category_ids),
        Category.is_active == True,
    ).all() if category_ids else []
    categories_by_id = {category.id: category for category in categories}
    if set(categories_by_id) != category_ids:
        raise HTTPException(status_code=422, detail="Una de las categorías no pertenece al proyecto")
    if any(
        entry.category_id is not None
        and categories_by_id[entry.category_id].rubro_id != entry.rubro_id
        for entry in entries
    ):
        raise HTTPException(status_code=422, detail="Una categoría no corresponde al rubro indicado")

    # Delete existing entries
    db.query(AvanceObra).filter(AvanceObra.project_id == project.id).delete()

    # Create new entries
    new_entries = []
    for entry in entries:
        avance = AvanceObra(
            project_id=project.id,
            rubro_id=entry.rubro_id,
            category_id=entry.category_id,
            percentage=entry.percentage,
            notes=entry.notes,
            updated_by=current_user.id,
        )
        db.add(avance)
        new_entries.append(avance)

    db.commit()

    # Reload with relationships
    result = (
        db.query(AvanceObra)
        .options(joinedload(AvanceObra.rubro), joinedload(AvanceObra.category))
        .filter(AvanceObra.project_id == project.id)
        .order_by(AvanceObra.rubro_id, AvanceObra.category_id)
        .all()
    )
    return result
