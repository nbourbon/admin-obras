from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.contribution import (
    ContributionCreate,
    ContributionResponse,
    ContributionWithUser,
    ContributionRejection,
    MemberBalanceResponse,
)
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header, is_project_admin
from app.models.user import User
from app.models.contribution import Contribution, ContributionStatus
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.services.contribution_manager import (
    create_contribution,
    approve_contribution,
    reject_contribution,
    get_member_balance,
    get_all_member_balances,
)
from app.services.file_storage import save_contribution_receipt, get_file_path, get_file_url

router = APIRouter(prefix="/contributions", tags=["Contributions"])


@router.post("", response_model=ContributionResponse, status_code=status.HTTP_201_CREATED)
async def create_new_contribution(
    contribution_data: ContributionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Create a new contribution (project member only).
    The contribution will be pending approval by a project admin.
    """
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required to create a contribution",
        )

    # Verify user is a member of the project
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == current_user.id,
        ProjectMember.is_active == True,
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this project to create contributions",
        )

    try:
        contribution = create_contribution(
            db=db,
            user_id=current_user.id,
            project_id=project.id,
            amount_original=contribution_data.amount_original,
            currency_original=contribution_data.currency_original,
            description=contribution_data.description,
            exchange_rate_override=contribution_data.exchange_rate_override,
            contribution_date=contribution_data.contribution_date,
        )
        return contribution
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/my", response_model=List[ContributionResponse])
async def get_my_contributions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Get current user's contributions for the current project.
    """
    query = db.query(Contribution).filter(Contribution.user_id == current_user.id)

    if project:
        query = query.filter(Contribution.project_id == project.id)

    contributions = query.order_by(Contribution.created_at.desc()).all()
    return contributions


@router.get("/pending", response_model=List[ContributionWithUser])
async def get_pending_contributions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Get all pending contributions for the current project (project admin only).
    """
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    contributions = (
        db.query(Contribution)
        .filter(
            Contribution.project_id == project.id,
            Contribution.status == ContributionStatus.PENDING,
        )
        .options(joinedload(Contribution.user))
        .order_by(Contribution.created_at.asc())
        .all()
    )

    result = []
    for contrib in contributions:
        result.append(
            ContributionWithUser(
                id=contrib.id,
                project_id=contrib.project_id,
                user_id=contrib.user_id,
                amount_original=contrib.amount_original,
                currency_original=contrib.currency_original,
                amount_usd=contrib.amount_usd,
                amount_ars=contrib.amount_ars,
                exchange_rate_used=contrib.exchange_rate_used,
                exchange_rate_source=contrib.exchange_rate_source,
                status=contrib.status,
                approved_by=contrib.approved_by,
                approved_at=contrib.approved_at,
                rejected_at=contrib.rejected_at,
                rejection_reason=contrib.rejection_reason,
                receipt_file_path=contrib.receipt_file_path,
                description=contrib.description,
                contribution_date=contrib.contribution_date,
                created_at=contrib.created_at,
                updated_at=contrib.updated_at,
                user_name=contrib.user.full_name,
                user_email=contrib.user.email,
            )
        )

    return result


@router.get("", response_model=List[ContributionWithUser])
async def list_all_contributions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
    status_filter: Optional[str] = None,
):
    """
    List all contributions for the current project (project admin only).
    """
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    query = (
        db.query(Contribution)
        .filter(Contribution.project_id == project.id)
        .options(joinedload(Contribution.user))
    )

    if status_filter:
        query = query.filter(Contribution.status == status_filter)

    contributions = query.order_by(Contribution.created_at.desc()).all()

    result = []
    for contrib in contributions:
        result.append(
            ContributionWithUser(
                id=contrib.id,
                project_id=contrib.project_id,
                user_id=contrib.user_id,
                amount_original=contrib.amount_original,
                currency_original=contrib.currency_original,
                amount_usd=contrib.amount_usd,
                amount_ars=contrib.amount_ars,
                exchange_rate_used=contrib.exchange_rate_used,
                exchange_rate_source=contrib.exchange_rate_source,
                status=contrib.status,
                approved_by=contrib.approved_by,
                approved_at=contrib.approved_at,
                rejected_at=contrib.rejected_at,
                rejection_reason=contrib.rejection_reason,
                receipt_file_path=contrib.receipt_file_path,
                description=contrib.description,
                contribution_date=contrib.contribution_date,
                created_at=contrib.created_at,
                updated_at=contrib.updated_at,
                user_name=contrib.user.full_name,
                user_email=contrib.user.email,
            )
        )

    return result


@router.put("/{contribution_id}/approve", response_model=ContributionResponse)
async def approve_contribution_endpoint(
    contribution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Approve a contribution (project admin only).
    This will update the member's balance.
    """
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()

    if not contribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found",
        )

    if project and contribution.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contribution does not belong to this project",
        )

    try:
        approved_contribution = approve_contribution(
            db=db,
            contribution_id=contribution_id,
            approved_by_user_id=current_user.id,
        )
        return approved_contribution
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{contribution_id}/reject", response_model=ContributionResponse)
async def reject_contribution_endpoint(
    contribution_id: int,
    rejection_data: ContributionRejection,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Reject a contribution (project admin only).
    This will NOT update the member's balance.
    """
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()

    if not contribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found",
        )

    if project and contribution.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contribution does not belong to this project",
        )

    try:
        rejected_contribution = reject_contribution(
            db=db,
            contribution_id=contribution_id,
            rejection_reason=rejection_data.rejection_reason,
        )
        return rejected_contribution
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{contribution_id}/receipt")
async def upload_contribution_receipt(
    contribution_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a receipt file for a contribution.
    Users can only upload receipts for their own contributions unless they are project admin.
    """
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()

    if not contribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found",
        )

    # Check access - user can upload their own receipts, or must be project admin
    is_admin = is_project_admin(db, current_user.id, contribution.project_id)
    if contribution.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload receipt for this contribution",
        )

    file_path = await save_contribution_receipt(file, contribution_id)
    contribution.receipt_file_path = file_path
    db.commit()

    return {"message": "Receipt uploaded successfully", "file_path": file_path}


@router.get("/{contribution_id}/receipt")
async def download_contribution_receipt(
    contribution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download a contribution's receipt file.
    Any project member can download receipts.
    """
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()

    if not contribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found",
        )

    # Verify user is a member of the project
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == contribution.project_id,
        ProjectMember.user_id == current_user.id,
        ProjectMember.is_active == True,
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to download this receipt",
        )

    if not contribution.receipt_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt file found for this contribution",
        )

    # Check if it's a Cloudinary URL
    url = get_file_url(contribution.receipt_file_path)
    if url:
        return Response(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": url},
        )

    # Local file
    file_path = get_file_path(contribution.receipt_file_path)
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt file not found",
        )

    return FileResponse(
        path=file_path,
        filename=f"contribution_{contribution_id}_receipt.{file_path.suffix}",
        media_type="application/octet-stream",
    )
