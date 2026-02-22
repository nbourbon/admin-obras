from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.payment import (
    PaymentResponse,
    PaymentMarkPaid,
    PaymentWithExpense,
    ExpenseInfo,
    UserInfo,
    PaymentApproval,
    MyPaymentItem,
)
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header, is_project_admin
from app.models.user import User
from app.models.expense import Expense
from app.models.payment import ParticipantPayment
from app.models.project import Project
from app.services.expense_splitter import update_expense_status
from app.services.exchange_rate import fetch_blue_dollar_rate_sync
from app.services.file_storage import save_receipt, get_file_path, get_file_url

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/my", response_model=List[PaymentWithExpense])
async def get_my_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
    pending_only: bool = False,
):
    """
    Get current user's payments with expense details for the current project.
    """
    query = (
        db.query(ParticipantPayment)
        .filter(
            ParticipantPayment.user_id == current_user.id,
            ParticipantPayment.is_deleted == False,
        )
        .options(joinedload(ParticipantPayment.expense))
    )

    # Filter by project if specified
    if project:
        query = query.join(Expense).filter(Expense.project_id == project.id)

    if pending_only:
        query = query.filter(ParticipantPayment.is_paid == False)

    payments = query.order_by(ParticipantPayment.created_at.desc()).all()

    # Cache projects by id to avoid N+1 queries
    project_cache: dict = {}

    result = []
    for payment in payments:
        expense = payment.expense
        # Get currency_mode from project (cached)
        project_id = expense.project_id
        if project_id not in project_cache:
            project_cache[project_id] = db.query(Project).filter(Project.id == project_id).first() if project_id else None
        project_obj = project_cache[project_id]
        currency_mode = getattr(project_obj, 'currency_mode', 'DUAL') or 'DUAL'

        expense_info = ExpenseInfo(
            id=expense.id,
            description=expense.description,
            amount_usd=expense.amount_usd,
            amount_ars=expense.amount_ars,
            expense_date=expense.expense_date,
            provider_name=expense.provider.name if expense.provider else None,
            category_name=expense.category.name if expense.category else None,
            currency_mode=currency_mode,
        )

        payment_with_expense = PaymentWithExpense(
            id=payment.id,
            expense_id=payment.expense_id,
            user_id=payment.user_id,
            amount_due_usd=payment.amount_due_usd,
            amount_due_ars=payment.amount_due_ars,
            amount_paid=payment.amount_paid,
            currency_paid=payment.currency_paid,
            is_pending_approval=payment.is_pending_approval,
            is_paid=payment.is_paid,
            paid_at=payment.paid_at,
            submitted_at=payment.submitted_at,
            approved_by=payment.approved_by,
            approved_at=payment.approved_at,
            rejection_reason=payment.rejection_reason,
            receipt_file_path=payment.receipt_file_path,
            exchange_rate_at_payment=payment.exchange_rate_at_payment,
            amount_paid_usd=payment.amount_paid_usd,
            amount_paid_ars=payment.amount_paid_ars,
            exchange_rate_source=payment.exchange_rate_source,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
            expense=expense_info,
        )
        result.append(payment_with_expense)

    return result


@router.get("/my-all", response_model=List[MyPaymentItem])
async def get_all_my_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
    pending_only: bool = False,
):
    """
    Get current user's EXPENSE payments (excluding contributions) for the current project.
    Contributions are managed separately in the /contributions page.
    Returns a list sorted by creation date.
    """
    result = []

    # Get expense payments ONLY (contributions are shown in /contributions page)
    expense_payments_query = (
        db.query(ParticipantPayment)
        .filter(
            ParticipantPayment.user_id == current_user.id,
            ParticipantPayment.is_deleted == False,
        )
        .options(joinedload(ParticipantPayment.expense))
    )

    if project:
        expense_payments_query = expense_payments_query.join(Expense).filter(Expense.project_id == project.id)

    if pending_only:
        expense_payments_query = expense_payments_query.filter(ParticipantPayment.is_paid == False)

    expense_payments = expense_payments_query.all()

    # Convert expense payments to MyPaymentItem
    for payment in expense_payments:
        expense = payment.expense
        # Get currency mode to determine which amount to show
        project_obj = db.query(Project).filter(Project.id == expense.project_id).first() if expense.project_id else None
        currency_mode = getattr(project_obj, 'currency_mode', 'DUAL') or 'DUAL'

        # Determine amount and currency to display (for backward compatibility)
        if currency_mode == "USD":
            amount_due = payment.amount_due_usd
            currency = "USD"
        elif currency_mode == "ARS":
            amount_due = payment.amount_due_ars
            currency = "ARS"
        else:  # DUAL - show both, but for simplicity show primary currency
            # Could show USD as primary or let frontend handle both
            amount_due = payment.amount_due_usd
            currency = "USD"

        result.append(MyPaymentItem(
            id=payment.id,
            payment_type="expense",
            description=expense.description,
            amount_due=amount_due,
            currency=currency,
            is_paid=payment.is_paid,
            paid_at=payment.paid_at,
            created_at=payment.created_at,
            # Dual currency amounts
            amount_due_usd=payment.amount_due_usd,
            amount_due_ars=payment.amount_due_ars,
            # Payment submission fields
            is_pending_approval=payment.is_pending_approval,
            submitted_at=payment.submitted_at,
            approved_at=payment.approved_at,
            rejection_reason=payment.rejection_reason,
            # Payment details
            amount_paid=payment.amount_paid,
            currency_paid=payment.currency_paid.value if payment.currency_paid else None,
            receipt_file_path=payment.receipt_file_path,
            # Expense fields
            expense_id=expense.id,
            provider_name=expense.provider.name if expense.provider else None,
            category_name=expense.category.name if expense.category else None,
            expense_date=expense.expense_date,
        ))

    # Sort by created_at descending
    result.sort(key=lambda x: x.created_at, reverse=True)

    return result


@router.get("/pending-approval", response_model=List[PaymentWithExpense])
async def get_pending_approval_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Get all payments pending admin approval for the current project (project admin only).
    Includes both expense payments and contribution payments.
    """
    from app.models.contribution import Contribution
    from app.models.contribution_payment import ContributionPayment

    # Get expense payments
    expense_query = (
        db.query(ParticipantPayment)
        .filter(ParticipantPayment.is_pending_approval == True)
        .options(
            joinedload(ParticipantPayment.expense),
            joinedload(ParticipantPayment.user)
        )
    )

    if project:
        expense_query = expense_query.join(Expense).filter(Expense.project_id == project.id)

    expense_payments = expense_query.order_by(ParticipantPayment.submitted_at.desc()).all()

    # Get contribution payments (pending approval OR submitted but not paid - for backwards compatibility)
    contribution_query = (
        db.query(ContributionPayment)
        .filter(
            (ContributionPayment.is_pending_approval == True) |
            ((ContributionPayment.submitted_at != None) & (ContributionPayment.is_paid == False))
        )
        .options(
            joinedload(ContributionPayment.contribution),
            joinedload(ContributionPayment.user)
        )
    )

    if project:
        contribution_query = contribution_query.join(Contribution).filter(Contribution.project_id == project.id)

    contribution_payments = contribution_query.order_by(ContributionPayment.submitted_at.desc()).all()

    print(f"[DEBUG pending-approval] Found {len(contribution_payments)} contribution payments for project {project.id if project else 'all'}")
    for cp in contribution_payments:
        print(f"  - Payment {cp.id}: user={cp.user_id}, is_pending={cp.is_pending_approval}, submitted={cp.submitted_at}")

    # Cache projects by id to avoid N+1 queries
    project_cache: dict = {}

    result = []

    # Process expense payments
    for payment in expense_payments:
        expense = payment.expense
        user = payment.user

        # Get currency_mode from project (cached)
        project_id = expense.project_id
        if project_id not in project_cache:
            project_cache[project_id] = db.query(Project).filter(Project.id == project_id).first() if project_id else None
        project_obj = project_cache[project_id]
        currency_mode = getattr(project_obj, 'currency_mode', 'DUAL') or 'DUAL'

        expense_info = ExpenseInfo(
            id=expense.id,
            description=expense.description,
            amount_usd=expense.amount_usd,
            amount_ars=expense.amount_ars,
            expense_date=expense.expense_date,
            provider_name=expense.provider.name if expense.provider else None,
            category_name=expense.category.name if expense.category else None,
            currency_mode=currency_mode,
        )

        user_info = UserInfo(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
        ) if user else None

        payment_with_expense = PaymentWithExpense(
            id=payment.id,
            expense_id=payment.expense_id,
            user_id=payment.user_id,
            amount_due_usd=payment.amount_due_usd,
            amount_due_ars=payment.amount_due_ars,
            amount_paid=payment.amount_paid,
            currency_paid=payment.currency_paid,
            is_pending_approval=payment.is_pending_approval,
            is_paid=payment.is_paid,
            paid_at=payment.paid_at,
            submitted_at=payment.submitted_at,
            approved_by=payment.approved_by,
            approved_at=payment.approved_at,
            rejection_reason=payment.rejection_reason,
            receipt_file_path=payment.receipt_file_path,
            exchange_rate_at_payment=payment.exchange_rate_at_payment,
            amount_paid_usd=payment.amount_paid_usd,
            amount_paid_ars=payment.amount_paid_ars,
            exchange_rate_source=payment.exchange_rate_source,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
            expense=expense_info,
            user=user_info,
        )
        result.append(payment_with_expense)

    # Process contribution payments (format as expenses for UI compatibility)
    for payment in contribution_payments:
        contribution = payment.contribution
        user = payment.user

        print(f"[DEBUG pending-approval] Processing contribution payment {payment.id}, contribution={contribution.id if contribution else 'None'}, user={user.id if user else 'None'}")

        # Get currency_mode from project (cached)
        project_id = contribution.project_id
        if project_id not in project_cache:
            project_cache[project_id] = db.query(Project).filter(Project.id == project_id).first() if project_id else None
        project_obj = project_cache[project_id]
        currency_mode = getattr(project_obj, 'currency_mode', 'DUAL') or 'DUAL'

        # Format contribution as expense info for UI compatibility
        expense_info = ExpenseInfo(
            id=contribution.id,
            description=f"[APORTE] {contribution.description}",  # Prefix to distinguish
            amount_usd=Decimal("0"),  # Contributions track differently
            amount_ars=contribution.amount if contribution.currency.value == "ARS" else Decimal("0"),
            expense_date=contribution.created_at,
            provider_name=None,
            category_name="Aporte",
            currency_mode=currency_mode,
        )

        user_info = UserInfo(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
        ) if user else None

        # Use amount_due and currency from contribution payment
        amount_due_usd = payment.amount_paid_usd or Decimal("0")
        amount_due_ars = payment.amount_paid_ars or payment.amount_due

        payment_with_expense = PaymentWithExpense(
            id=payment.id,
            expense_id=None,  # No expense_id for contributions
            user_id=payment.user_id,
            amount_due_usd=amount_due_usd,
            amount_due_ars=amount_due_ars,
            amount_paid=payment.amount_paid,
            currency_paid=payment.currency_paid,
            is_pending_approval=payment.is_pending_approval,
            is_paid=payment.is_paid,
            paid_at=payment.paid_at,
            submitted_at=payment.submitted_at,
            approved_by=payment.approved_by,
            approved_at=payment.approved_at,
            rejection_reason=payment.rejection_reason,
            receipt_file_path=payment.receipt_file_path,
            exchange_rate_at_payment=payment.exchange_rate_at_payment,
            amount_paid_usd=payment.amount_paid_usd,
            amount_paid_ars=payment.amount_paid_ars,
            exchange_rate_source=payment.exchange_rate_source,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
            expense=expense_info,
            user=user_info,
        )
        result.append(payment_with_expense)

    # Sort all payments by submitted_at (most recent first)
    result.sort(key=lambda x: x.submitted_at, reverse=True)

    return result


@router.get("/{payment_id}", response_model=PaymentWithExpense)
async def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific payment.
    Users can only view their own payments unless they are admin.
    """
    payment = (
        db.query(ParticipantPayment)
        .options(
            joinedload(ParticipantPayment.expense),
            joinedload(ParticipantPayment.user)
        )
        .filter(ParticipantPayment.id == payment_id)
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # Check access - user can view their own payments, or must be project admin
    expense = payment.expense
    is_admin = expense.project_id and is_project_admin(db, current_user.id, expense.project_id)
    if payment.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment",
        )

    expense = payment.expense
    user = payment.user

    # Get currency_mode from project
    project_obj = db.query(Project).filter(Project.id == expense.project_id).first() if expense.project_id else None
    currency_mode = getattr(project_obj, 'currency_mode', 'DUAL') or 'DUAL'

    expense_info = ExpenseInfo(
        id=expense.id,
        description=expense.description,
        amount_usd=expense.amount_usd,
        amount_ars=expense.amount_ars,
        expense_date=expense.expense_date,
        provider_name=expense.provider.name if expense.provider else None,
        category_name=expense.category.name if expense.category else None,
        currency_mode=currency_mode,
    )

    user_info = UserInfo(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
    ) if user else None

    return PaymentWithExpense(
        id=payment.id,
        expense_id=payment.expense_id,
        user_id=payment.user_id,
        amount_due_usd=payment.amount_due_usd,
        amount_due_ars=payment.amount_due_ars,
        amount_paid=payment.amount_paid,
        currency_paid=payment.currency_paid,
        is_pending_approval=payment.is_pending_approval,
        is_paid=payment.is_paid,
        paid_at=payment.paid_at,
        submitted_at=payment.submitted_at,
        approved_by=payment.approved_by,
        approved_at=payment.approved_at,
        rejection_reason=payment.rejection_reason,
        receipt_file_path=payment.receipt_file_path,
        exchange_rate_at_payment=payment.exchange_rate_at_payment,
        amount_paid_usd=payment.amount_paid_usd,
        amount_paid_ars=payment.amount_paid_ars,
        exchange_rate_source=payment.exchange_rate_source,
        created_at=payment.created_at,
        updated_at=payment.updated_at,
        expense=expense_info,
        user=user_info,
    )


@router.put("/{payment_id}/submit-payment", response_model=PaymentResponse)
async def submit_payment(
    payment_id: int,
    payment_data: PaymentMarkPaid,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a payment for approval.
    Users can only submit their own payments.
    Payment will be marked as pending approval until admin approves.
    """
    payment = db.query(ParticipantPayment).filter(ParticipantPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
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

    # Check if this is an individual project or if user is admin (auto-approve)
    is_individual = False
    user_is_admin = False
    expense = db.query(Expense).filter(Expense.id == payment.expense_id).first()
    if expense and expense.project_id:
        project = db.query(Project).filter(Project.id == expense.project_id).first()
        is_individual = project.is_individual if project else False
        user_is_admin = is_project_admin(db, current_user.id, expense.project_id)
        print(f"[DEBUG submit_payment] Payment {payment_id}, Expense {expense.id}, Project {expense.project_id}, is_individual={is_individual}, user_is_admin={user_is_admin}")

    payment.amount_paid = payment_data.amount_paid
    payment.currency_paid = payment_data.currency_paid
    payment.payment_date = payment_data.payment_date or datetime.utcnow()
    payment.submitted_at = datetime.utcnow()
    payment.rejection_reason = None  # Clear any previous rejection

    # Track exchange rate at payment time based on currency mode
    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL' if project else 'DUAL'

    if currency_mode == "ARS":
        payment.amount_paid_ars = payment_data.amount_paid
        payment.amount_paid_usd = None
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None
    elif currency_mode == "USD":
        payment.amount_paid_usd = payment_data.amount_paid
        payment.amount_paid_ars = None
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None
    else:
        # DUAL mode - track exchange rate and calculate equivalents
        if payment_data.exchange_rate_override:
            tc = payment_data.exchange_rate_override
            payment.exchange_rate_source = "manual"
        else:
            try:
                tc = fetch_blue_dollar_rate_sync()
                payment.exchange_rate_source = "auto"
            except Exception:
                tc = None
                payment.exchange_rate_source = None

        payment.exchange_rate_at_payment = tc

        if tc and tc > 0:
            if payment_data.currency_paid.value == "USD":
                payment.amount_paid_usd = payment_data.amount_paid
                payment.amount_paid_ars = (Decimal(str(payment_data.amount_paid)) * Decimal(str(tc))).quantize(Decimal("0.01"))
            else:  # ARS
                payment.amount_paid_ars = payment_data.amount_paid
                payment.amount_paid_usd = (Decimal(str(payment_data.amount_paid)) / Decimal(str(tc))).quantize(Decimal("0.01"))
        else:
            if payment_data.currency_paid.value == "USD":
                payment.amount_paid_usd = payment_data.amount_paid
            else:
                payment.amount_paid_ars = payment_data.amount_paid

    # Auto-approve if: individual project OR user is project admin
    if is_individual or user_is_admin:
        # Auto-approve for individual projects or admin users
        payment.is_paid = True
        payment.is_pending_approval = False
        payment.paid_at = datetime.utcnow()
        payment.approved_at = datetime.utcnow()
        payment.approved_by = current_user.id
        reason = "individual project" if is_individual else "admin self-approval"
        print(f"[DEBUG submit_payment] Auto-approved payment {payment_id} ({reason})")
    else:
        # Mark as pending approval for non-admin users in multi-participant projects
        payment.is_pending_approval = True
        print(f"[DEBUG submit_payment] Payment {payment_id} marked as pending approval")

    db.commit()
    db.refresh(payment)

    # Update expense status
    from app.services.expense_splitter import update_expense_status
    update_expense_status(db, payment.expense_id)

    return payment


@router.put("/{payment_id}/approve", response_model=PaymentResponse)
async def approve_payment(
    payment_id: int,
    approval: PaymentApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve or reject a payment (project admin only).
    Handles both expense payments (ParticipantPayment) and contribution payments (ContributionPayment).
    """
    from app.models.contribution import Contribution
    from app.models.contribution_payment import ContributionPayment
    from app.models.project_member import ProjectMember
    from app.models.project import Project

    # Try to find payment in ParticipantPayment first
    payment = db.query(ParticipantPayment).filter(ParticipantPayment.id == payment_id).first()

    # If not found, try ContributionPayment
    if not payment:
        contribution_payment = db.query(ContributionPayment).filter(ContributionPayment.id == payment_id).first()

        if contribution_payment:
            # Handle contribution payment approval
            contribution = db.query(Contribution).filter(Contribution.id == contribution_payment.contribution_id).first()

            if not contribution:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Contribution not found",
                )

            # Verify user is admin of the project
            if not is_project_admin(db, current_user.id, contribution.project_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You must be an admin of this project",
                )

            # Check if payment is pending approval
            if not contribution_payment.is_pending_approval and not (contribution_payment.submitted_at and not contribution_payment.is_paid):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payment is not pending approval",
                )

            if approval.approved:
                # Approve the contribution payment
                contribution_payment.is_pending_approval = False
                contribution_payment.is_paid = True
                contribution_payment.paid_at = datetime.utcnow()
                contribution_payment.approved_by = current_user.id
                contribution_payment.approved_at = datetime.utcnow()
                contribution_payment.rejection_reason = None

                # Credit the balance to the member's account
                member = db.query(ProjectMember).filter(
                    ProjectMember.project_id == contribution.project_id,
                    ProjectMember.user_id == contribution_payment.user_id,
                ).first()

                if member:
                    project = db.query(Project).filter(Project.id == contribution.project_id).first()
                    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

                    # Credit balance according to currency_mode
                    if currency_mode == "ARS":
                        member.balance_ars += contribution_payment.amount_paid_ars if contribution_payment.amount_paid_ars else contribution_payment.amount_paid
                    elif currency_mode == "USD":
                        member.balance_usd += contribution_payment.amount_paid_usd if contribution_payment.amount_paid_usd else contribution_payment.amount_paid
                    else:  # DUAL - balance is stored ONLY in ARS
                        member.balance_ars += contribution_payment.amount_paid_ars if contribution_payment.amount_paid_ars else contribution_payment.amount_paid

                    member.balance_updated_at = datetime.utcnow()
                    print(f"[DEBUG approve_payment] Contribution approved: credited balance to user {contribution_payment.user_id}, new balance ARS: {member.balance_ars}, USD: {member.balance_usd}")
            else:
                # Reject the contribution payment
                contribution_payment.is_pending_approval = False
                contribution_payment.is_paid = False
                contribution_payment.paid_at = None
                contribution_payment.amount_paid = None
                contribution_payment.currency_paid = None
                contribution_payment.amount_paid_usd = None
                contribution_payment.amount_paid_ars = None
                contribution_payment.exchange_rate_at_payment = None
                contribution_payment.exchange_rate_source = None
                contribution_payment.rejection_reason = approval.rejection_reason or "Rejected by admin"
                contribution_payment.approved_by = current_user.id
                contribution_payment.approved_at = datetime.utcnow()
                print(f"[DEBUG approve_payment] Contribution rejected: payment {contribution_payment.id} for user {contribution_payment.user_id}")

            db.commit()
            db.refresh(contribution_payment)

            # Return a PaymentResponse-compatible response (mimicking ParticipantPayment structure)
            # This allows the frontend to handle it uniformly
            return {
                "id": contribution_payment.id,
                "expense_id": None,
                "user_id": contribution_payment.user_id,
                "amount_due_usd": contribution_payment.amount_paid_usd or Decimal("0"),
                "amount_due_ars": contribution_payment.amount_paid_ars or contribution_payment.amount_due,
                "amount_paid": contribution_payment.amount_paid,
                "currency_paid": contribution_payment.currency_paid,
                "is_pending_approval": contribution_payment.is_pending_approval,
                "is_paid": contribution_payment.is_paid,
                "paid_at": contribution_payment.paid_at,
                "submitted_at": contribution_payment.submitted_at,
                "approved_by": contribution_payment.approved_by,
                "approved_at": contribution_payment.approved_at,
                "rejection_reason": contribution_payment.rejection_reason,
                "receipt_file_path": contribution_payment.receipt_file_path,
                "exchange_rate_at_payment": contribution_payment.exchange_rate_at_payment,
                "amount_paid_usd": contribution_payment.amount_paid_usd,
                "amount_paid_ars": contribution_payment.amount_paid_ars,
                "exchange_rate_source": contribution_payment.exchange_rate_source,
                "created_at": contribution_payment.created_at,
                "updated_at": contribution_payment.updated_at,
            }
        else:
            # Payment not found in either table
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found",
            )

    # Verify user is admin of the payment's expense project
    expense = db.query(Expense).filter(Expense.id == payment.expense_id).first()
    if expense and expense.project_id and not is_project_admin(db, current_user.id, expense.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    if not payment.is_pending_approval:
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

        # NEW LOGIC: If this is a contribution (not a regular expense), credit the balance
        if expense and expense.is_contribution:
            from app.models.project_member import ProjectMember
            from app.models.project import Project

            # Get project and member
            project = db.query(Project).filter(Project.id == expense.project_id).first()
            member = db.query(ProjectMember).filter(
                ProjectMember.project_id == expense.project_id,
                ProjectMember.user_id == payment.user_id,
            ).first()

            if member and project:
                currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

                # Credit balance according to currency_mode
                if currency_mode == "ARS":
                    member.balance_ars += payment.amount_due_ars
                elif currency_mode == "USD":
                    member.balance_usd += payment.amount_due_usd
                else:  # DUAL
                    # In DUAL mode, balance is stored ONLY in ARS
                    member.balance_ars += payment.amount_due_ars

                member.balance_updated_at = datetime.utcnow()
                print(f"[DEBUG approve_payment] Contribution approved: credited {payment.amount_due_ars} ARS to user {payment.user_id}")
    else:
        # Reject the payment
        payment.is_pending_approval = False
        payment.is_paid = False
        payment.amount_paid = None
        payment.currency_paid = None
        payment.rejection_reason = approval.rejection_reason or "Rejected by admin"
        payment.approved_by = current_user.id
        payment.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(payment)

    # Update expense status
    update_expense_status(db, payment.expense_id)

    return payment


@router.put("/{payment_id}/mark-paid", response_model=PaymentResponse)
async def mark_payment_as_paid(
    payment_id: int,
    payment_data: PaymentMarkPaid,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark a payment as paid (project admin only).
    Admin can directly mark any participant's payment as paid, bypassing the approval flow.
    Includes payment_date and exchange_rate support for historical backfilling.
    """
    payment = db.query(ParticipantPayment).filter(ParticipantPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # Check if user is project admin
    expense = db.query(Expense).filter(Expense.id == payment.expense_id).first()
    is_admin = expense and expense.project_id and is_project_admin(db, current_user.id, expense.project_id)

    # Redirect to submit_payment for non-admins
    if not is_admin:
        return await submit_payment(payment_id, payment_data, db, current_user)

    if payment.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is already paid",
        )

    project = db.query(Project).filter(Project.id == expense.project_id).first() if expense and expense.project_id else None
    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

    payment.amount_paid = payment_data.amount_paid
    payment.currency_paid = payment_data.currency_paid
    payment.payment_date = payment_data.payment_date or datetime.utcnow()
    payment.submitted_at = datetime.utcnow()
    payment.rejection_reason = None

    # Calculate exchange rates based on currency mode
    if currency_mode == "ARS":
        payment.amount_paid_ars = payment_data.amount_paid
        payment.amount_paid_usd = None
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None
    elif currency_mode == "USD":
        payment.amount_paid_usd = payment_data.amount_paid
        payment.amount_paid_ars = None
        payment.exchange_rate_at_payment = None
        payment.exchange_rate_source = None
    else:  # DUAL
        if payment_data.exchange_rate_override:
            tc = payment_data.exchange_rate_override
            payment.exchange_rate_source = "manual"
        else:
            try:
                tc = fetch_blue_dollar_rate_sync()
                payment.exchange_rate_source = "auto"
            except Exception:
                tc = None
                payment.exchange_rate_source = None

        payment.exchange_rate_at_payment = tc

        if tc and tc > 0:
            if payment_data.currency_paid.value == "USD":
                payment.amount_paid_usd = payment_data.amount_paid
                payment.amount_paid_ars = (Decimal(str(payment_data.amount_paid)) * Decimal(str(tc))).quantize(Decimal("0.01"))
            else:  # ARS
                payment.amount_paid_ars = payment_data.amount_paid
                payment.amount_paid_usd = (Decimal(str(payment_data.amount_paid)) / Decimal(str(tc))).quantize(Decimal("0.01"))
        else:
            if payment_data.currency_paid.value == "USD":
                payment.amount_paid_usd = payment_data.amount_paid
            else:
                payment.amount_paid_ars = payment_data.amount_paid

    # Admin mark as paid = directly approved
    payment.is_pending_approval = False
    payment.is_paid = True
    payment.paid_at = datetime.utcnow()
    payment.approved_by = current_user.id
    payment.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(payment)

    # Update expense status
    update_expense_status(db, payment.expense_id)

    return payment


@router.put("/{payment_id}/unmark-paid", response_model=PaymentResponse)
async def unmark_payment_as_paid(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Unmark a payment as paid (useful for corrections).
    Project admin only for approved payments.
    """
    payment = db.query(ParticipantPayment).filter(ParticipantPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # Check if user is project admin
    expense = db.query(Expense).filter(Expense.id == payment.expense_id).first()
    is_admin = expense and expense.project_id and is_project_admin(db, current_user.id, expense.project_id)

    # Only project admin can unmark approved payments
    if payment.is_paid and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project admin can unmark approved payments",
        )

    # Users can cancel their own pending submissions
    if payment.is_pending_approval and payment.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this submission",
        )

    payment.amount_paid = None
    payment.currency_paid = None
    payment.is_pending_approval = False
    payment.is_paid = False
    payment.paid_at = None
    payment.submitted_at = None
    payment.approved_by = None
    payment.approved_at = None
    payment.rejection_reason = None

    db.commit()
    db.refresh(payment)

    # Update expense status
    update_expense_status(db, payment.expense_id)

    return payment


@router.post("/{payment_id}/receipt")
async def upload_receipt(
    payment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a receipt file for a payment.
    Users can only upload receipts for their own payments unless they are admin.
    """
    payment = db.query(ParticipantPayment).filter(ParticipantPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # Check access - user can upload their own receipts, or must be project admin
    expense = db.query(Expense).filter(Expense.id == payment.expense_id).first()
    is_admin = expense and expense.project_id and is_project_admin(db, current_user.id, expense.project_id)
    if payment.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload receipt for this payment",
        )

    file_path = await save_receipt(file, payment_id)
    payment.receipt_file_path = file_path
    db.commit()

    return {"message": "Receipt uploaded successfully", "file_path": file_path}


@router.get("/{payment_id}/receipt")
async def download_receipt(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download the receipt file for a payment.
    For Cloudinary files, redirects to the URL.
    For local files, returns the file directly.
    """
    payment = db.query(ParticipantPayment).filter(ParticipantPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # Project admins can always view, users can only view their own
    expense = db.query(Expense).filter(Expense.id == payment.expense_id).first()
    is_admin = expense and expense.project_id and is_project_admin(db, current_user.id, expense.project_id)
    if payment.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this receipt",
        )

    if not payment.receipt_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt uploaded for this payment",
        )

    # Check if it's a Cloudinary URL — proxy instead of redirect to avoid CORS/Content-Type issues
    file_url = get_file_url(payment.receipt_file_path)
    if file_url:
        import httpx
        filename = payment.receipt_file_path.split('/')[-1].split('?')[0]
        media_type = "application/pdf" if filename.lower().endswith('.pdf') else "application/octet-stream"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(file_url, follow_redirects=True, timeout=30)
            return Response(
                content=resp.content,
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

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/octet-stream",
    )


@router.delete("/{payment_id}")
async def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete a payment.
    Users can delete their own unpaid payments.
    Admins can delete any payment.
    Paid payments cannot be deleted.
    """
    payment = db.query(ParticipantPayment).filter(ParticipantPayment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # Check if user is project admin or payment owner
    expense = db.query(Expense).filter(Expense.id == payment.expense_id).first()
    is_admin = expense and expense.project_id and is_project_admin(db, current_user.id, expense.project_id)
    is_owner = payment.user_id == current_user.id

    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this payment",
        )

    # Cannot delete paid payments
    if payment.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un pago que ya fue aprobado. Contacte al administrador.",
        )

    # Soft delete the payment
    payment.is_deleted = True
    payment.deleted_at = datetime.utcnow()
    payment.deleted_by = current_user.id

    db.commit()

    # Update expense status
    update_expense_status(db, payment.expense_id)

    return {"message": "Pago eliminado correctamente"}
