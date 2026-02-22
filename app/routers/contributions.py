from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import FileResponse
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
)
from app.schemas.payment import PaymentMarkPaid, PaymentApproval
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

        result.append(ContributionWithMyPayment(
            **contrib.__dict__,
            created_by_name=contrib.created_by_user.full_name,
            created_by_email=contrib.created_by_user.email,
            my_payment_id=my_payment_id,
            my_amount_due=my_amount_due,
            i_paid=i_paid,
            is_pending_approval=is_pending_approval,
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
            print(f"[DEBUG submit_contribution_payment] Auto-approved: credited {payment.amount_paid_ars} ARS to user {current_user.id}, new balance: {member.balance_ars}")
    else:
        # Multi-participant project: Mark as submitted, pending admin approval
        # Do NOT set is_paid=True or credit balance yet
        payment.is_paid = False
        payment.is_pending_approval = True
        payment.paid_at = None
        payment.approved_at = None
        payment.approved_by = None
        payment.rejection_reason = None
        print(f"[DEBUG submit_contribution_payment] Pending approval: payment {payment.id} for user {current_user.id}")

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

                print(f"[DEBUG submit_contribution_payment] Auto-paid expense {expense.id} for user {current_user.id}, new balance: {member.balance_ars}")

                # Update expense status
                db.commit()
                update_expense_status(db, expense.id)
            else:
                # Balance not sufficient, stop trying (since we process oldest first)
                break

        if auto_paid_count > 0:
            print(f"[DEBUG submit_contribution_payment] Auto-paid {auto_paid_count} pending expenses after contribution payment")

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
    from app.services.file_storage import get_file_path

    payment = db.query(ContributionPayment).filter(ContributionPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution payment not found",
        )

    if not payment.receipt_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt found for this payment",
        )

    file_path = get_file_path(payment.receipt_file_path)

    return FileResponse(
        path=file_path,
        media_type='application/octet-stream',
        filename=payment.receipt_file_path.split('/')[-1]
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
            print(f"[DEBUG approve_contribution_payment] Approved: credited balance to user {payment.user_id}, new balance ARS: {member.balance_ars}, USD: {member.balance_usd}")
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
        print(f"[DEBUG approve_contribution_payment] Rejected: payment {payment.id} for user {payment.user_id}, reason: {payment.rejection_reason}")

    db.commit()
    db.refresh(payment)

    return {"message": "Payment processed successfully", "is_paid": payment.is_paid}


