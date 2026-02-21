from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.contribution import (
    ContributionCreate,
    ContributionResponse,
    ContributionWithDetails,
    ContributionWithMyPayment,
    ContributionDetailResponse,
    ContributionPaymentDetail,
)
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header
from app.models.user import User
from app.models.contribution import Contribution, Currency
from app.models.contribution_payment import ContributionPayment
from app.models.project import Project
from app.models.project_member import ProjectMember

router = APIRouter(prefix="/contributions", tags=["Contributions"])


@router.get("", response_model=List[ContributionWithMyPayment])
async def list_contributions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
    skip: int = 0,
    limit: int = 100,
):
    """List all contribution requests for the current project with current user's payment info"""
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    contributions = (
        db.query(Contribution)
        .filter(Contribution.project_id == project.id)
        .order_by(Contribution.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Add payment stats and current user's payment info to each contribution
    result = []
    for contrib in contributions:
        payments = db.query(ContributionPayment).filter(
            ContributionPayment.contribution_id == contrib.id
        ).all()

        # Find current user's payment
        my_payment = next((p for p in payments if p.user_id == current_user.id), None)
        my_amount_due = my_payment.amount_due if my_payment else Decimal("0")
        i_paid = my_payment.is_paid if my_payment else False

        paid_count = sum(1 for p in payments if p.is_paid)
        is_complete = paid_count == len(payments) if payments else False

        result.append(ContributionWithMyPayment(
            **contrib.__dict__,
            created_by_name=contrib.created_by_user.full_name,
            created_by_email=contrib.created_by_user.email,
            my_amount_due=my_amount_due,
            i_paid=i_paid,
            is_complete=is_complete,
            total_participants=len(payments),
            paid_participants=paid_count,
        ))

    return result


@router.get("/{contribution_id}", response_model=ContributionDetailResponse)
async def get_contribution(
    contribution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """Get a specific contribution request with full participant payment details"""
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()

    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    if project and contribution.project_id != project.id:
        raise HTTPException(status_code=403, detail="Contribution belongs to different project")

    # Get all payments with user info
    payments = db.query(ContributionPayment).filter(
        ContributionPayment.contribution_id == contribution.id
    ).all()

    payment_details = []
    for payment in payments:
        user = payment.user
        payment_details.append(ContributionPaymentDetail(
            payment_id=payment.id,
            user_id=payment.user_id,
            user_name=user.full_name if user else "Unknown",
            user_email=user.email if user else "",
            amount_due=payment.amount_due,
            is_paid=payment.is_paid,
            paid_at=payment.paid_at,
        ))

    paid_count = sum(1 for p in payments if p.is_paid)
    is_complete = paid_count == len(payments) if payments else False

    return ContributionDetailResponse(
        **contribution.__dict__,
        created_by_name=contribution.created_by_user.full_name,
        created_by_email=contribution.created_by_user.email,
        payments=payment_details,
        total_participants=len(payments),
        paid_participants=paid_count,
        is_complete=is_complete,
    )


@router.post("", response_model=ContributionResponse, status_code=status.HTTP_201_CREATED)
async def create_contribution(
    contribution_data: ContributionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """Create a new contribution request (project admin only)"""
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    # Create contribution record
    contribution = Contribution(
        description=contribution_data.description,
        amount=contribution_data.amount,
        currency=contribution_data.currency,
        project_id=project.id,
        created_by=current_user.id,
    )
    
    db.add(contribution)
    db.flush()  # Get the ID

    # Create contribution payments (split among all active members)
    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.is_active == True
    ).all()

    for member in members:
        percentage = member.participation_percentage / Decimal(100)
        amount_due = (contribution_data.amount * percentage).quantize(Decimal("0.01"))

        payment = ContributionPayment(
            contribution_id=contribution.id,
            user_id=member.user_id,
            amount_due=amount_due,
            is_paid=False,
        )
        db.add(payment)

    db.commit()
    db.refresh(contribution)

    return contribution


