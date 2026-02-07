from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseWithPayments, PaymentSummary
from app.utils.dependencies import get_current_user, get_project_admin_user, get_project_from_header, is_project_admin
from app.models.user import User
from app.models.expense import Expense, Currency
from app.models.provider import Provider
from app.models.category import Category
from app.models.payment import ParticipantPayment
from app.models.project import Project
from app.services.exchange_rate import fetch_blue_dollar_rate_sync, convert_currency, log_exchange_rate
from app.services.expense_splitter import create_participant_payments, update_expense_status
from app.services.file_storage import save_invoice, get_file_path, get_file_url

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("", response_model=List[ExpenseResponse])
async def list_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
    provider_id: Optional[int] = Query(None, description="Filter by provider"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    from_date: Optional[datetime] = Query(None, description="Filter from date"),
    to_date: Optional[datetime] = Query(None, description="Filter to date"),
    include_deleted: bool = Query(False, description="Include deleted expenses (admin only)"),
    skip: int = 0,
    limit: int = 100,
):
    """
    List all expenses for the current project with optional filters.
    By default, deleted expenses are excluded. Admins can include them with include_deleted=true.
    """
    query = (
        db.query(Expense)
        .options(joinedload(Expense.provider), joinedload(Expense.category))
    )

    if project:
        query = query.filter(Expense.project_id == project.id)

    # Filter deleted expenses unless admin specifically requests them
    if not include_deleted:
        query = query.filter(Expense.is_deleted == False)

    if provider_id:
        query = query.filter(Expense.provider_id == provider_id)
    if category_id:
        query = query.filter(Expense.category_id == category_id)
    if status_filter:
        query = query.filter(Expense.status == status_filter)
    if from_date:
        query = query.filter(Expense.expense_date >= from_date)
    if to_date:
        query = query.filter(Expense.expense_date <= to_date)

    return (
        query
        .order_by(Expense.expense_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("", response_model=ExpenseWithPayments, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense_data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Create a new expense (project admin only).
    This will automatically create payment records for all active project members.
    """
    # Project is required for new expenses
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Project-ID header is required to create an expense",
        )

    # Validate provider exists and belongs to project
    provider = db.query(Provider).filter(Provider.id == expense_data.provider_id).first()
    if not provider or not provider.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or inactive provider",
        )
    if provider.project_id and provider.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider does not belong to this project",
        )

    # Validate category exists and belongs to project
    category = db.query(Category).filter(Category.id == expense_data.category_id).first()
    if not category or not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or inactive category",
        )
    if category.project_id and category.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category does not belong to this project",
        )

    # Get current exchange rate
    exchange_rate = fetch_blue_dollar_rate_sync()
    log_exchange_rate(db, exchange_rate)

    # Convert to both currencies
    amount_usd, amount_ars = convert_currency(
        expense_data.amount_original,
        expense_data.currency_original.value,
        exchange_rate,
    )

    # Create expense
    expense = Expense(
        description=expense_data.description,
        amount_original=expense_data.amount_original,
        currency_original=expense_data.currency_original,
        amount_usd=amount_usd,
        amount_ars=amount_ars,
        exchange_rate_used=exchange_rate,
        provider_id=expense_data.provider_id,
        category_id=expense_data.category_id,
        created_by=current_user.id,
        project_id=project.id,
        expense_date=expense_data.expense_date or datetime.utcnow(),
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    # Create participant payments for project members
    payments = create_participant_payments(db, expense)

    # Build response with payments
    payment_summaries = []
    for p in payments:
        user = db.query(User).filter(User.id == p.user_id).first()
        payment_summaries.append(PaymentSummary(
            user_id=p.user_id,
            user_name=user.full_name if user else "Unknown",
            amount_due_usd=p.amount_due_usd,
            amount_due_ars=p.amount_due_ars,
            is_paid=p.is_paid,
            paid_at=p.paid_at,
        ))

    # Reload with relationships
    expense = (
        db.query(Expense)
        .options(joinedload(Expense.provider), joinedload(Expense.category))
        .filter(Expense.id == expense.id)
        .first()
    )

    # Build response manually to avoid validation issues with participant_payments
    response_data = {
        "id": expense.id,
        "description": expense.description,
        "amount_original": expense.amount_original,
        "currency_original": expense.currency_original,
        "amount_usd": expense.amount_usd,
        "amount_ars": expense.amount_ars,
        "exchange_rate_used": expense.exchange_rate_used,
        "provider_id": expense.provider_id,
        "category_id": expense.category_id,
        "created_by": expense.created_by,
        "invoice_file_path": expense.invoice_file_path,
        "status": expense.status,
        "expense_date": expense.expense_date,
        "created_at": expense.created_at,
        "updated_at": expense.updated_at,
        "provider": expense.provider,
        "category": expense.category,
        "participant_payments": payment_summaries,
        "total_paid_usd": Decimal("0"),
        "total_pending_usd": sum(Decimal(str(p.amount_due_usd)) for p in payment_summaries),
    }

    return ExpenseWithPayments(**response_data)


@router.get("/{expense_id}", response_model=ExpenseWithPayments)
async def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get expense details with payment status.
    """
    expense = (
        db.query(Expense)
        .options(joinedload(Expense.provider), joinedload(Expense.category))
        .filter(Expense.id == expense_id)
        .first()
    )

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Get payments
    payments = (
        db.query(ParticipantPayment)
        .filter(ParticipantPayment.expense_id == expense_id)
        .all()
    )

    payment_summaries = []
    total_paid_usd = Decimal("0")
    total_pending_usd = Decimal("0")

    for p in payments:
        user = db.query(User).filter(User.id == p.user_id).first()
        payment_summaries.append(PaymentSummary(
            user_id=p.user_id,
            user_name=user.full_name if user else "Unknown",
            amount_due_usd=p.amount_due_usd,
            amount_due_ars=p.amount_due_ars,
            is_paid=p.is_paid,
            paid_at=p.paid_at,
        ))
        if p.is_paid:
            total_paid_usd += Decimal(str(p.amount_due_usd))
        else:
            total_pending_usd += Decimal(str(p.amount_due_usd))

    response_data = {
        "id": expense.id,
        "description": expense.description,
        "amount_original": expense.amount_original,
        "currency_original": expense.currency_original,
        "amount_usd": expense.amount_usd,
        "amount_ars": expense.amount_ars,
        "exchange_rate_used": expense.exchange_rate_used,
        "provider_id": expense.provider_id,
        "category_id": expense.category_id,
        "created_by": expense.created_by,
        "invoice_file_path": expense.invoice_file_path,
        "status": expense.status,
        "expense_date": expense.expense_date,
        "created_at": expense.created_at,
        "updated_at": expense.updated_at,
        "provider": expense.provider,
        "category": expense.category,
        "participant_payments": payment_summaries,
        "total_paid_usd": total_paid_usd,
        "total_pending_usd": total_pending_usd,
    }

    return ExpenseWithPayments(**response_data)


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an expense (project admin only).
    Note: Updating amount will NOT recalculate participant payments.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Verify user is admin of the expense's project
    if expense.project_id and not is_project_admin(db, current_user.id, expense.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    update_data = expense_data.model_dump(exclude_unset=True)

    # If amount or currency is being updated, recalculate conversions
    if "amount_original" in update_data or "currency_original" in update_data:
        amount = update_data.get("amount_original", expense.amount_original)
        currency = update_data.get("currency_original", expense.currency_original)

        exchange_rate = fetch_blue_dollar_rate_sync()
        amount_usd, amount_ars = convert_currency(amount, currency.value, exchange_rate)

        update_data["amount_usd"] = amount_usd
        update_data["amount_ars"] = amount_ars
        update_data["exchange_rate_used"] = exchange_rate

    for field, value in update_data.items():
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)

    # Reload with relationships
    expense = (
        db.query(Expense)
        .options(joinedload(Expense.provider), joinedload(Expense.category))
        .filter(Expense.id == expense.id)
        .first()
    )

    return expense


@router.post("/{expense_id}/invoice")
async def upload_invoice(
    expense_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an invoice file for an expense (project admin only).
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Verify user is admin of the expense's project
    if expense.project_id and not is_project_admin(db, current_user.id, expense.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this project",
        )

    file_path = await save_invoice(file, expense_id)
    expense.invoice_file_path = file_path
    db.commit()

    return {"message": "Invoice uploaded successfully", "file_path": file_path}


@router.get("/{expense_id}/invoice")
async def download_invoice(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download the invoice file for an expense.
    For Cloudinary files, redirects to the URL.
    For local files, returns the file directly.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    if not expense.invoice_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No invoice uploaded for this expense",
        )

    # Check if it's a Cloudinary URL
    file_url = get_file_url(expense.invoice_file_path)
    if file_url:
        return RedirectResponse(url=file_url)

    # Local file
    file_path = get_file_path(expense.invoice_file_path)
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice file not found",
        )

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/octet-stream",
    )


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete an expense (project admin only).
    Can only delete if there are no active payments associated.
    Payments pending approval will be automatically cancelled.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Check if user is project admin
    if expense.project_id and not is_project_admin(db, current_user.id, expense.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project admins can delete expenses",
        )

    # Check for active payments (not deleted)
    active_payments = (
        db.query(ParticipantPayment)
        .filter(
            ParticipantPayment.expense_id == expense_id,
            ParticipantPayment.is_deleted == False,
        )
        .all()
    )

    # Check if there are paid payments or pending non-approval payments
    blocking_payments = []
    pending_approvals = []

    for payment in active_payments:
        if payment.is_paid:
            blocking_payments.append(f"{payment.user.full_name} (pagado)")
        elif not payment.is_pending_approval and (payment.amount_paid is not None):
            blocking_payments.append(f"{payment.user.full_name} (pendiente de eliminar)")
        elif payment.is_pending_approval:
            pending_approvals.append(payment)

    if blocking_payments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede eliminar el gasto. Los siguientes participantes deben eliminar sus pagos primero: {', '.join(blocking_payments)}",
        )

    # Auto-cancel payments that are pending approval
    for payment in pending_approvals:
        payment.is_deleted = True
        payment.deleted_at = datetime.utcnow()
        payment.deleted_by = current_user.id

    # Soft delete the expense
    expense.is_deleted = True
    expense.deleted_at = datetime.utcnow()
    expense.deleted_by = current_user.id

    db.commit()

    return {"message": "Gasto eliminado correctamente"}


@router.put("/{expense_id}/restore")
async def restore_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Restore a deleted expense (project admin only).
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Check if user is project admin
    if expense.project_id and not is_project_admin(db, current_user.id, expense.project_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project admins can restore expenses",
        )

    if not expense.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expense is not deleted",
        )

    # Restore the expense
    expense.is_deleted = False
    expense.deleted_at = None
    expense.deleted_by = None

    db.commit()
    db.refresh(expense)

    return expense
