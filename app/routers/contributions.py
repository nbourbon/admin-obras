from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.contribution import (
    ContributionCreate,
    ContributionResponse,
    ContributionWithDetails,
    ContributionWithMyPayment,
    BalanceAdjustmentCreate,
    ContributionDetailResponse,
    ContributionPaymentDetail,
    UnilateralContributionCreate,
    UnabsorbedContributionResponse,
)
from app.models.contribution_absorption import ContributionAbsorption
from app.schemas.payment import PaymentMarkPaid, PaymentApproval, AdminMarkContributionPaid
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header
from app.models.user import User
from app.models.contribution import Contribution, Currency, ContributionStatus
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
        my_payment_id = my_payment.id if my_payment else None
        my_amount_due = my_payment.amount_due if my_payment else Decimal("0")

        # Calculate payment status
        i_paid = my_payment.is_paid if my_payment else False
        is_pending_approval = False
        if my_payment and not my_payment.is_paid and my_payment.submitted_at is not None:
            is_pending_approval = True

        paid_count = sum(1 for p in payments if p.is_paid)
        is_complete = paid_count == len(payments) if payments else False

        # Contributor name for unilateral contributions
        contributor_name = None
        if contrib.is_unilateral and contrib.contributor_user:
            contributor_name = contrib.contributor_user.full_name

        my_amount_offset = Decimal("0")
        if my_payment and hasattr(my_payment, 'amount_offset') and my_payment.amount_offset:
            my_amount_offset = my_payment.amount_offset

        result.append(ContributionWithMyPayment(
            **contrib.__dict__,
            created_by_name=contrib.created_by_user.full_name,
            created_by_email=contrib.created_by_user.email,
            contributor_name=contributor_name,
            my_payment_id=my_payment_id,
            my_amount_due=my_amount_due,
            my_amount_offset=my_amount_offset,
            i_paid=i_paid,
            is_pending_approval=is_pending_approval,
            is_complete=is_complete,
            total_participants=len(payments),
            paid_participants=paid_count,
        ))

    return result


@router.get("/unilateral/unabsorbed", response_model=List[UnabsorbedContributionResponse])
async def list_unabsorbed_unilateral(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """List unilateral contributions with remaining balance (not fully absorbed). Admin only."""
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    contributions = db.query(Contribution).filter(
        Contribution.project_id == project.id,
        Contribution.is_unilateral == True,
        Contribution.status == ContributionStatus.APPROVED,
    ).order_by(Contribution.created_at.asc()).all()

    from app.models.payment import ParticipantPayment

    result = []
    for c in contributions:
        raw_remaining = Decimal(str(c.amount)) - Decimal(str(c.absorbed_amount))
        if raw_remaining <= 0:
            continue

        if raw_remaining <= 0:
            continue
        net_remaining = raw_remaining

        contributor_name = c.contributor_user.full_name if c.contributor_user else "Desconocido"
        result.append(UnabsorbedContributionResponse(
            id=c.id,
            description=c.description,
            amount=c.amount,
            absorbed_amount=c.absorbed_amount,
            remaining=net_remaining,
            currency=c.currency,
            contributor_user_id=c.contributor_user_id,
            contributor_name=contributor_name,
            created_at=c.created_at,
        ))

    return result


@router.get("/my-pending/count", response_model=dict)
async def get_my_pending_contributions_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Get count of pending contribution payments for the current user.
    Returns { "count": int }
    Only counts contributions where the current user has NOT paid yet.
    """
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    # Count contribution payments for this user that are not paid
    count = db.query(ContributionPayment).join(Contribution).filter(
        Contribution.project_id == project.id,
        ContributionPayment.user_id == current_user.id,
        ContributionPayment.is_paid == False,
    ).count()

    return {"count": count}


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
    
    # Force refresh to get latest receipt_file_path values
    for payment in payments:
        db.refresh(payment)

    payment_details = []
    for payment in payments:
        user = payment.user
        offset = Decimal(str(payment.amount_offset)) if payment.amount_offset else Decimal("0")
        remaining = Decimal(str(payment.amount_due)) - offset
        # Determine if payment is pending approval (submitted but not yet approved)
        is_pending_approval = not payment.is_paid and payment.submitted_at is not None
        
        payment_details.append(ContributionPaymentDetail(
            payment_id=payment.id,
            user_id=payment.user_id,
            user_name=user.full_name if user else "Unknown",
            user_email=user.email if user else "",
            amount_due=payment.amount_due,
            amount_offset=offset,
            amount_remaining=remaining,
            is_paid=payment.is_paid,
            is_pending_approval=is_pending_approval,
            paid_at=payment.paid_at,
            receipt_file_path=payment.receipt_file_path,
            amount_paid=payment.amount_paid,
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
    """Create a new contribution request (project admin only). Optionally absorb unilateral contributions."""
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

    payments_by_user = {}
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
        db.flush()
        payments_by_user[member.user_id] = payment

    # Absorb unilateral contributions if specified
    if contribution_data.absorb_unilateral_ids:
        now = datetime.utcnow()
        for unilateral_id in contribution_data.absorb_unilateral_ids:
            unilateral = db.query(Contribution).filter(
                Contribution.id == unilateral_id,
                Contribution.project_id == project.id,
                Contribution.is_unilateral == True,
                Contribution.status == ContributionStatus.APPROVED,
            ).first()
            if not unilateral:
                continue

            raw_remaining = Decimal(str(unilateral.amount)) - Decimal(str(unilateral.absorbed_amount))
            if raw_remaining <= 0:
                continue

            # Find the payment for the contributor in this solicitud
            user_payment = payments_by_user.get(unilateral.contributor_user_id)
            if not user_payment:
                continue

            remaining = raw_remaining
            if remaining <= 0:
                continue

            current_offset = Decimal(str(user_payment.amount_offset or 0))
            available_to_offset = Decimal(str(user_payment.amount_due)) - current_offset
            if available_to_offset <= 0:
                continue

            # Note: unilateral contributions from expenses are stored in the project's
            # balance currency (ARS for DUAL mode, USD for USD mode). No conversion needed.
            absorption = min(remaining, available_to_offset)

            # Create absorption record
            absorption_record = ContributionAbsorption(
                solicitud_id=contribution.id,
                unilateral_id=unilateral.id,
                user_id=unilateral.contributor_user_id,
                amount_absorbed=absorption,
                currency=contribution_data.currency.value,
                created_at=now,
            )
            db.add(absorption_record)

            # Update absorbed_amount and payment offset (both in the same currency)
            unilateral.absorbed_amount = Decimal(str(unilateral.absorbed_amount)) + absorption
            user_payment.amount_offset = current_offset + absorption

            # If fully covered, auto-mark as paid (WITHOUT crediting balance — already credited with unilateral)
            if user_payment.amount_offset >= Decimal(str(user_payment.amount_due)):
                user_payment.is_paid = True
                user_payment.paid_at = now
                user_payment.payment_date = now
                user_payment.submitted_at = now
                user_payment.approved_at = now
                user_payment.approved_by = current_user.id
                user_payment.amount_paid = user_payment.amount_due
                user_payment.currency_paid = contribution_data.currency.value
                if contribution_data.currency.value == "USD":
                    user_payment.amount_paid_usd = user_payment.amount_due
                    user_payment.amount_paid_ars = Decimal("0")
                else:
                    user_payment.amount_paid_ars = user_payment.amount_due
                    user_payment.amount_paid_usd = Decimal("0")

    db.commit()
    db.refresh(contribution)

    return contribution


@router.post("/unilateral", response_model=ContributionResponse, status_code=status.HTTP_201_CREATED)
async def create_unilateral_contribution(
    data: UnilateralContributionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """Create a direct (unilateral) contribution. Any member can do this."""
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    # Validate contribution_mode allows this
    type_params = getattr(project, 'type_parameters', None) or {}
    contribution_mode = type_params.get('contribution_mode', 'both')
    if contribution_mode == 'direct_payment':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este proyecto no usa cuenta corriente. No se pueden crear aportes directos.",
        )

    # Check user is a member
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == current_user.id,
        ProjectMember.is_active == True,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No sos miembro activo de este proyecto",
        )

    # Check no pending contribution payments for this user (formal requests)
    pending_formal = db.query(ContributionPayment).join(Contribution).filter(
        Contribution.project_id == project.id,
        Contribution.is_unilateral == False,
        Contribution.is_adjustment == False,
        ContributionPayment.user_id == current_user.id,
        ContributionPayment.is_paid == False,
    ).first()
    if pending_formal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenés aportes pendientes de solicitudes formales. Pagá primero esos aportes.",
        )

    from app.utils.dependencies import is_project_admin as check_admin

    is_individual = project.is_individual
    user_is_admin = check_admin(db, current_user.id, project.id)
    auto_approve = is_individual or user_is_admin

    now = datetime.utcnow()

    contribution = Contribution(
        description=data.description,
        amount=data.amount,
        currency=data.currency,
        project_id=project.id,
        created_by=current_user.id,
        status=ContributionStatus.APPROVED if auto_approve else ContributionStatus.PENDING,
        is_unilateral=True,
        contributor_user_id=current_user.id,
    )
    db.add(contribution)
    db.flush()

    # Create single payment for this user
    cp = ContributionPayment(
        contribution_id=contribution.id,
        user_id=current_user.id,
        amount_due=data.amount,
        is_paid=False,
    )

    if auto_approve:
        cp.amount_paid = data.amount
        cp.is_paid = True
        cp.paid_at = now
        cp.payment_date = now
        cp.submitted_at = now
        cp.approved_at = now
        cp.approved_by = current_user.id
        cp.currency_paid = data.currency.value
        if data.currency.value == "USD":
            cp.amount_paid_usd = data.amount
            cp.amount_paid_ars = Decimal("0")
        else:
            cp.amount_paid_ars = data.amount
            cp.amount_paid_usd = Decimal("0")

        # Credit balance
        currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'
        if currency_mode == "USD":
            member.balance_usd += data.amount
        else:
            member.balance_ars += data.amount
        member.balance_updated_at = now

    db.add(cp)
    db.commit()
    db.refresh(contribution)

    return contribution


@router.post("/adjust-balance", response_model=ContributionResponse, status_code=status.HTTP_201_CREATED)
async def create_balance_adjustment(
    adjustment_data: BalanceAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """Create a direct balance adjustment (admin only). Amount can be positive or negative."""
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required",
        )

    if adjustment_data.amount == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto del ajuste no puede ser cero",
        )

    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

    # Create contribution as already APPROVED
    contribution = Contribution(
        description=adjustment_data.description,
        amount=adjustment_data.amount,
        currency=adjustment_data.currency,
        project_id=project.id,
        created_by=current_user.id,
        status=ContributionStatus.APPROVED,
        is_adjustment=True,
    )
    db.add(contribution)
    db.flush()

    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.is_active == True,
    ).all()

    now = datetime.utcnow()

    for member in members:
        percentage = member.participation_percentage / Decimal(100)
        member_amount = (adjustment_data.amount * percentage).quantize(Decimal("0.01"))

        payment = ContributionPayment(
            contribution_id=contribution.id,
            user_id=member.user_id,
            amount_due=member_amount,
            amount_paid=member_amount,
            is_paid=True,
            is_pending_approval=False,
            paid_at=now,
            approved_at=now,
            approved_by=current_user.id,
            currency_paid=adjustment_data.currency.value,
        )
        if currency_mode == "USD":
            payment.amount_paid_usd = member_amount
            payment.amount_paid_ars = Decimal("0")
        else:
            payment.amount_paid_ars = member_amount
            payment.amount_paid_usd = Decimal("0")
        db.add(payment)

        # Update member balance
        if currency_mode == "USD":
            member.balance_usd += member_amount
        else:
            member.balance_ars += member_amount
        member.balance_updated_at = now

    db.commit()
    db.refresh(contribution)

    return contribution


@router.put("/payments/{payment_id}/submit", status_code=status.HTTP_200_OK)
async def submit_contribution_payment(
    payment_id: int,
    payment_data: PaymentMarkPaid,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Submit a contribution payment (mark as paid).
    For individual projects or if user is admin, auto-approves.
    Otherwise, marks as pending approval.
    """
    from datetime import datetime
    from app.utils.dependencies import is_project_admin

    payment = db.query(ContributionPayment).filter(ContributionPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution payment not found",
        )

    # Check access - only own payments
    if payment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to submit this payment",
        )

    if payment.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is already approved and paid",
        )

    # Get contribution and project to check if individual or user is admin
    contribution = db.query(Contribution).filter(Contribution.id == payment.contribution_id).first()
    if not contribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found",
        )

    project_obj = db.query(Project).filter(Project.id == contribution.project_id).first()
    is_individual = project_obj.is_individual if project_obj else False
    user_is_admin = is_project_admin(db, current_user.id, contribution.project_id)
    currency_mode = getattr(project_obj, 'currency_mode', 'DUAL') or 'DUAL'

    # Update payment info
    payment.amount_paid = payment_data.amount_paid
    payment.payment_date = payment_data.payment_date or datetime.utcnow()
    payment.submitted_at = datetime.utcnow()

    # Calculate dual currency equivalents based on currency_mode
    if currency_mode == "DUAL":
        # In DUAL mode, contributions are ALWAYS in ARS
        payment.currency_paid = "ARS"
        payment.amount_paid_ars = payment.amount_paid

        # Get exchange rate to convert to USD for dashboard calculations
        from app.services.exchange_rate import fetch_blue_dollar_rate_sync
        if payment_data.exchange_rate_override:
            exchange_rate = Decimal(str(payment_data.exchange_rate_override))
            payment.exchange_rate_source = "manual"
        else:
            try:
                exchange_rate = fetch_blue_dollar_rate_sync()
                payment.exchange_rate_source = "auto"
            except Exception:
                # If exchange rate fetch fails, we can't calculate USD equivalent
                exchange_rate = None
                payment.exchange_rate_source = None

        payment.exchange_rate_at_payment = exchange_rate
        if exchange_rate and exchange_rate > 0:
            payment.amount_paid_usd = (payment.amount_paid / exchange_rate).quantize(Decimal("0.01"))
        else:
            payment.amount_paid_usd = Decimal(0)

    elif currency_mode == "USD":
        # Single currency USD: contributions are in USD
        payment.currency_paid = "USD"
        payment.amount_paid_usd = payment.amount_paid
        payment.amount_paid_ars = Decimal(0)
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None

    else:  # ARS
        # Single currency ARS: contributions are in ARS
        payment.currency_paid = "ARS"
        payment.amount_paid_ars = payment.amount_paid
        payment.amount_paid_usd = Decimal(0)
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None

    # Auto-approve for individual projects OR if user is admin
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == contribution.project_id,
        ProjectMember.user_id == current_user.id,
    ).first()

    if is_individual or user_is_admin:
        payment.is_paid = True
        payment.paid_at = datetime.utcnow()
        payment.approved_at = datetime.utcnow()
        payment.approved_by = current_user.id

        # IMPORTANT: Credit the balance to the user's account
        if member:
            # Credit balance according to currency_mode
            if currency_mode == "ARS":
                member.balance_ars += payment.amount_paid_ars
            elif currency_mode == "USD":
                member.balance_usd += payment.amount_paid_usd
            else:  # DUAL - balance is stored ONLY in ARS
                member.balance_ars += payment.amount_paid_ars

            member.balance_updated_at = datetime.utcnow()
    else:
        # Multi-participant project: Mark as submitted, pending admin approval
        # Do NOT set is_paid=True or credit balance yet
        payment.is_paid = False
        payment.is_pending_approval = True
        payment.paid_at = None
        payment.approved_at = None
        payment.approved_by = None
        payment.rejection_reason = None

    db.commit()
    db.refresh(payment)

    # NEW: Auto-pay pending expenses if balance is sufficient
    if member:
        from app.models.payment import ParticipantPayment
        from app.models.expense import Expense
        from app.services.expense_splitter import check_sufficient_balance, auto_pay_from_balance, update_expense_status

        # Get all pending payments for this user in this project (oldest first)
        pending_payments = (
            db.query(ParticipantPayment)
            .join(Expense)
            .filter(
                ParticipantPayment.user_id == current_user.id,
                ParticipantPayment.is_paid == False,
                ParticipantPayment.is_deleted == False,
                Expense.project_id == contribution.project_id,
                Expense.is_deleted == False,
            )
            .order_by(Expense.created_at.asc())  # Pay oldest expenses first
            .all()
        )

        auto_paid_count = 0
        for pending_payment in pending_payments:
            expense = pending_payment.expense

            # Check if current balance is sufficient for this expense
            has_sufficient_balance = check_sufficient_balance(
                member,
                pending_payment.amount_due_usd,
                pending_payment.amount_due_ars,
                currency_mode,
                expense,
            )

            if has_sufficient_balance:
                # Auto-pay this expense
                pending_payment.is_paid = True
                pending_payment.paid_at = datetime.utcnow()
                pending_payment.payment_date = datetime.utcnow()
                pending_payment.submitted_at = datetime.utcnow()
                pending_payment.approved_at = datetime.utcnow()
                pending_payment.approved_by = current_user.id

                # Set payment amounts and currency
                if currency_mode == "USD":
                    pending_payment.amount_paid = pending_payment.amount_due_usd
                    pending_payment.currency_paid = "USD"
                    pending_payment.amount_paid_usd = pending_payment.amount_due_usd
                    pending_payment.amount_paid_ars = Decimal(0)
                else:
                    pending_payment.amount_paid = pending_payment.amount_due_ars
                    pending_payment.currency_paid = "ARS"
                    pending_payment.amount_paid_ars = pending_payment.amount_due_ars
                    if currency_mode == "DUAL":
                        pending_payment.amount_paid_usd = pending_payment.amount_due_usd
                    else:
                        pending_payment.amount_paid_usd = Decimal(0)

                pending_payment.exchange_rate_at_payment = expense.exchange_rate_used
                pending_payment.exchange_rate_source = expense.exchange_rate_source

                # Deduct from balance
                if currency_mode == "ARS":
                    member.balance_ars -= pending_payment.amount_due_ars
                elif currency_mode == "USD":
                    member.balance_usd -= pending_payment.amount_due_usd
                else:  # DUAL
                    if expense.currency_original.value == "ARS":
                        member.balance_ars -= pending_payment.amount_due_ars
                    else:
                        amount_due_ars_equivalent = pending_payment.amount_due_usd * expense.exchange_rate_used
                        member.balance_ars -= amount_due_ars_equivalent

                member.balance_updated_at = datetime.utcnow()
                auto_paid_count += 1

                # Update expense status
                db.commit()
                update_expense_status(db, expense.id)
                db.commit()
            else:
                # Balance not sufficient, stop trying (since we process oldest first)
                break

    return {"message": "Payment submitted successfully", "is_paid": payment.is_paid}


@router.post("/payments/{payment_id}/receipt", status_code=status.HTTP_200_OK)
async def upload_contribution_receipt(
    payment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload receipt for a contribution payment"""
    from app.services.file_storage import save_receipt

    payment = db.query(ContributionPayment).filter(ContributionPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution payment not found",
        )

    # Check access - only own payments
    if payment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload receipt for this payment",
        )

    # Save receipt file
    file_path = await save_receipt(file, payment_id)
    payment.receipt_file_path = file_path

    db.commit()

    return {"message": "Receipt uploaded successfully", "file_path": file_path}


@router.get("/payments/{payment_id}/receipt")
async def download_contribution_receipt(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download receipt for a contribution payment"""
    from app.services.file_storage import get_file_path, get_file_url

    payment = db.query(ContributionPayment).filter(ContributionPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution payment not found",
        )
    
    # Force refresh to get latest receipt_file_path
    db.refresh(payment)

    if not payment.receipt_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt found for this payment",
        )

    # Check if it's a Cloudinary URL — proxy to avoid CORS issues
    file_url = get_file_url(payment.receipt_file_path)
    if file_url:
        import httpx
        filename = payment.receipt_file_path.split('/')[-1].split('?')[0]
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(file_url, follow_redirects=True, timeout=30)
            content = resp.content
            if content[:5] == b'%PDF-':
                media_type = "application/pdf"
            elif filename.lower().endswith('.pdf'):
                media_type = "application/pdf"
            elif filename.lower().endswith(('.jpg', '.jpeg')):
                media_type = "image/jpeg"
            elif filename.lower().endswith('.png'):
                media_type = "image/png"
            else:
                media_type = resp.headers.get("content-type", "application/octet-stream")
            if media_type == "application/pdf" and not filename.lower().endswith('.pdf'):
                filename = f"{filename}.pdf"
            return Response(
                content=content,
                media_type=media_type,
                headers={"Content-Disposition": f"inline; filename=\"{filename}\""},
            )
        except Exception:
            raise HTTPException(status_code=502, detail="Error fetching file from storage")

    # Local file
    file_path = get_file_path(payment.receipt_file_path)
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt file not found",
        )

    name = file_path.name.lower()
    if name.endswith('.pdf'):
        media_type = "application/pdf"
    elif name.endswith(('.jpg', '.jpeg')):
        media_type = "image/jpeg"
    elif name.endswith('.png'):
        media_type = "image/png"
    else:
        media_type = "application/octet-stream"

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=media_type,
    )


@router.put("/payments/{payment_id}/approve", status_code=status.HTTP_200_OK)
async def approve_contribution_payment(
    payment_id: int,
    approval: PaymentApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve or reject a contribution payment (project admin only).
    """
    from datetime import datetime
    from app.utils.dependencies import is_project_admin

    payment = db.query(ContributionPayment).filter(ContributionPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution payment not found",
        )

    # Get contribution and verify user is admin of the project
    contribution = db.query(Contribution).filter(Contribution.id == payment.contribution_id).first()
    if not contribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found",
        )

    if not is_project_admin(db, current_user.id, contribution.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    # Check if payment is pending approval (or backwards compatible check)
    if not payment.is_pending_approval and not (payment.submitted_at and not payment.is_paid):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is not pending approval",
        )

    if approval.approved:
        # Approve the payment
        payment.is_pending_approval = False
        payment.is_paid = True
        payment.paid_at = datetime.utcnow()
        payment.approved_by = current_user.id
        payment.approved_at = datetime.utcnow()
        payment.rejection_reason = None

        # Credit the balance to the member's account
        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == contribution.project_id,
            ProjectMember.user_id == payment.user_id,
        ).first()

        if member:
            project = db.query(Project).filter(Project.id == contribution.project_id).first()
            currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

            # Credit balance according to currency_mode
            if currency_mode == "ARS":
                member.balance_ars += payment.amount_paid_ars if payment.amount_paid_ars else payment.amount_paid
            elif currency_mode == "USD":
                member.balance_usd += payment.amount_paid_usd if payment.amount_paid_usd else payment.amount_paid
            else:  # DUAL - balance is stored ONLY in ARS
                member.balance_ars += payment.amount_paid_ars if payment.amount_paid_ars else payment.amount_paid

            member.balance_updated_at = datetime.utcnow()
    else:
        # Reject the payment
        payment.is_pending_approval = False
        payment.is_paid = False
        payment.paid_at = None
        payment.amount_paid = None
        payment.currency_paid = None
        payment.amount_paid_usd = None
        payment.amount_paid_ars = None
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None
        payment.rejection_reason = approval.rejection_reason or "Rejected by admin"
        payment.approved_by = current_user.id
        payment.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(payment)

    return {"message": "Payment processed successfully", "is_paid": payment.is_paid}


@router.put("/payments/{payment_id}/mark-paid", status_code=status.HTTP_200_OK)
async def admin_mark_contribution_paid(
    payment_id: int,
    data: AdminMarkContributionPaid,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark a contribution payment as paid directly (project admin only).
    This allows admin to register a payment without the user submitting it first.
    """
    from datetime import datetime
    from app.utils.dependencies import is_project_admin
    from app.services.exchange_rate import fetch_blue_dollar_rate_sync

    payment = db.query(ContributionPayment).filter(ContributionPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution payment not found",
        )

    # Get contribution and verify user is admin of the project
    contribution = db.query(Contribution).filter(Contribution.id == payment.contribution_id).first()
    if not contribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found",
        )

    if not is_project_admin(db, current_user.id, contribution.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    # Check if payment is already paid
    if payment.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is already marked as paid",
        )

    project = db.query(Project).filter(Project.id == contribution.project_id).first()
    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

    # Determine amount to use
    amount_paid = data.amount_paid if data.amount_paid else payment.amount_due

    # Update payment info
    payment.amount_paid = amount_paid
    payment.payment_date = data.payment_date or datetime.utcnow()
    payment.submitted_at = datetime.utcnow()
    payment.is_paid = True
    payment.paid_at = datetime.utcnow()
    payment.approved_by = current_user.id
    payment.approved_at = datetime.utcnow()
    payment.is_pending_approval = False

    # Calculate dual currency equivalents
    if currency_mode == "DUAL":
        # In DUAL mode, contributions are ALWAYS in ARS
        payment.currency_paid = "ARS"
        payment.amount_paid_ars = amount_paid

        # Get exchange rate to convert to USD
        if data.exchange_rate_override:
            exchange_rate = Decimal(str(data.exchange_rate_override))
            payment.exchange_rate_source = "manual"
        else:
            try:
                exchange_rate = fetch_blue_dollar_rate_sync()
                payment.exchange_rate_source = "auto"
            except Exception:
                exchange_rate = None
                payment.exchange_rate_source = None

        payment.exchange_rate_at_payment = exchange_rate
        if exchange_rate and exchange_rate > 0:
            payment.amount_paid_usd = (amount_paid / exchange_rate).quantize(Decimal("0.01"))
        else:
            payment.amount_paid_usd = None

    elif currency_mode == "ARS":
        payment.currency_paid = "ARS"
        payment.amount_paid_ars = amount_paid
        payment.amount_paid_usd = None
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None

    else:  # USD mode
        payment.currency_paid = "USD"
        payment.amount_paid_usd = amount_paid
        payment.amount_paid_ars = None
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None

    # Credit the balance to the member's account
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == contribution.project_id,
        ProjectMember.user_id == payment.user_id,
    ).first()

    if member:
        # Credit balance according to currency_mode
        if currency_mode == "ARS":
            member.balance_ars += payment.amount_paid_ars if payment.amount_paid_ars else amount_paid
        elif currency_mode == "USD":
            member.balance_usd += payment.amount_paid_usd if payment.amount_paid_usd else amount_paid
        else:  # DUAL - balance is stored ONLY in ARS
            member.balance_ars += payment.amount_paid_ars if payment.amount_paid_ars else amount_paid

        member.balance_updated_at = datetime.utcnow()

    db.commit()
    db.refresh(payment)

    return {
        "message": "Payment marked as paid successfully",
        "is_paid": payment.is_paid,
        "amount_paid": float(payment.amount_paid),
        "user_id": payment.user_id,
    }


