from typing import List
from fastapi import APIRouter, Depends
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
