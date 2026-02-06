from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.payment import PaymentResponse, PaymentMarkPaid, PaymentWithExpense, ExpenseInfo, UserInfo, PaymentApproval
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header, is_project_admin
from app.models.user import User
from app.models.expense import Expense
from app.models.payment import ParticipantPayment
from app.models.project import Project
from app.services.expense_splitter import update_expense_status
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
        .filter(ParticipantPayment.user_id == current_user.id)
        .options(joinedload(ParticipantPayment.expense))
    )

    # Filter by project if specified
    if project:
        query = query.join(Expense).filter(Expense.project_id == project.id)

    if pending_only:
        query = query.filter(ParticipantPayment.is_paid == False)

    payments = query.order_by(ParticipantPayment.created_at.desc()).all()

    result = []
    for payment in payments:
        expense = payment.expense
        expense_info = ExpenseInfo(
            id=expense.id,
            description=expense.description,
            amount_usd=expense.amount_usd,
            amount_ars=expense.amount_ars,
            expense_date=expense.expense_date,
            provider_name=expense.provider.name if expense.provider else None,
            category_name=expense.category.name if expense.category else None,
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
            created_at=payment.created_at,
            updated_at=payment.updated_at,
            expense=expense_info,
        )
        result.append(payment_with_expense)

    return result


@router.get("/pending-approval", response_model=List[PaymentWithExpense])
async def get_pending_approval_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Get all payments pending admin approval for the current project (project admin only).
    """
    query = (
        db.query(ParticipantPayment)
        .filter(ParticipantPayment.is_pending_approval == True)
        .options(
            joinedload(ParticipantPayment.expense),
            joinedload(ParticipantPayment.user)
        )
    )

    # Filter by project if specified
    if project:
        query = query.join(Expense).filter(Expense.project_id == project.id)

    payments = query.order_by(ParticipantPayment.submitted_at.desc()).all()

    result = []
    for payment in payments:
        expense = payment.expense
        user = payment.user

        expense_info = ExpenseInfo(
            id=expense.id,
            description=expense.description,
            amount_usd=expense.amount_usd,
            amount_ars=expense.amount_ars,
            expense_date=expense.expense_date,
            provider_name=expense.provider.name if expense.provider else None,
            category_name=expense.category.name if expense.category else None,
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
            created_at=payment.created_at,
            updated_at=payment.updated_at,
            expense=expense_info,
            user=user_info,
        )
        result.append(payment_with_expense)

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

    expense_info = ExpenseInfo(
        id=expense.id,
        description=expense.description,
        amount_usd=expense.amount_usd,
        amount_ars=expense.amount_ars,
        expense_date=expense.expense_date,
        provider_name=expense.provider.name if expense.provider else None,
        category_name=expense.category.name if expense.category else None,
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

    # Check if this is an individual project (auto-approve)
    is_individual = False
    expense = db.query(Expense).filter(Expense.id == payment.expense_id).first()
    if expense and expense.project_id:
        project = db.query(Project).filter(Project.id == expense.project_id).first()
        is_individual = project.is_individual if project else False
        print(f"[DEBUG submit_payment] Payment {payment_id}, Expense {expense.id}, Project {expense.project_id}, is_individual={is_individual}")

    payment.amount_paid = payment_data.amount_paid
    payment.currency_paid = payment_data.currency_paid
    payment.submitted_at = datetime.utcnow()
    payment.rejection_reason = None  # Clear any previous rejection

    if is_individual:
        # Auto-approve for individual projects
        payment.is_paid = True
        payment.is_pending_approval = False
        payment.paid_at = datetime.utcnow()
        payment.approved_at = datetime.utcnow()
        payment.approved_by = current_user.id  # Set approved_by for individual projects
        print(f"[DEBUG submit_payment] Auto-approved payment {payment_id} for individual project")
    else:
        # Mark as pending approval for multi-participant projects
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
    """
    payment = db.query(ParticipantPayment).filter(ParticipantPayment.id == payment_id).first()

    if not payment:
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
    Mark a payment as paid (legacy - redirects to submit-payment).
    For backwards compatibility. Use submit-payment instead.
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

    # Project admins can directly mark as paid (bypass approval)
    payment.amount_paid = payment_data.amount_paid
    payment.currency_paid = payment_data.currency_paid
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

    # Check if it's a Cloudinary URL
    file_url = get_file_url(payment.receipt_file_path)
    if file_url:
        return RedirectResponse(url=file_url)

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
