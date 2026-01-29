from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.database import get_db
from app.schemas.dashboard import (
    DashboardSummary,
    ExpenseEvolution,
    MonthlyExpense,
    UserPaymentStatus,
    ExpensePaymentStatus,
    ParticipantStatus,
)
from app.utils.dependencies import get_current_user, get_project_from_header
from app.models.user import User
from app.models.expense import Expense
from app.models.payment import ParticipantPayment
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.services.exchange_rate import fetch_blue_dollar_rate_sync
from app.services.expense_splitter import get_user_payment_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Get overall dashboard summary with totals for the current project.
    """
    # Build expense query
    expense_query = db.query(
        func.sum(Expense.amount_usd).label("total_usd"),
        func.sum(Expense.amount_ars).label("total_ars"),
        func.count(Expense.id).label("count"),
    )
    if project:
        expense_query = expense_query.filter(Expense.project_id == project.id)

    expense_totals = expense_query.first()

    total_expenses_usd = Decimal(str(expense_totals.total_usd or 0))
    total_expenses_ars = Decimal(str(expense_totals.total_ars or 0))
    expenses_count = expense_totals.count or 0

    # Get payment totals (filter by project through expense)
    paid_query = db.query(
        func.sum(ParticipantPayment.amount_due_usd).label("paid_usd"),
        func.sum(ParticipantPayment.amount_due_ars).label("paid_ars"),
    ).filter(ParticipantPayment.is_paid == True)

    if project:
        paid_query = paid_query.join(Expense).filter(Expense.project_id == project.id)

    paid_payments = paid_query.first()

    total_paid_usd = Decimal(str(paid_payments.paid_usd or 0))
    total_paid_ars = Decimal(str(paid_payments.paid_ars or 0))

    # Calculate pending
    total_pending_usd = total_expenses_usd - total_paid_usd
    total_pending_ars = total_expenses_ars - total_paid_ars

    # Get participant count
    if project:
        participants_count = (
            db.query(ProjectMember)
            .join(User)
            .filter(ProjectMember.project_id == project.id)
            .filter(ProjectMember.is_active == True)
            .filter(User.is_active == True)
            .filter(ProjectMember.participation_percentage > 0)
            .count()
        )
    else:
        participants_count = (
            db.query(User)
            .filter(User.is_active == True)
            .filter(User.participation_percentage > 0)
            .count()
        )

    # Get current exchange rate
    try:
        current_rate = fetch_blue_dollar_rate_sync()
    except Exception:
        current_rate = Decimal("0")

    return DashboardSummary(
        total_expenses_usd=total_expenses_usd,
        total_expenses_ars=total_expenses_ars,
        total_paid_usd=total_paid_usd,
        total_paid_ars=total_paid_ars,
        total_pending_usd=total_pending_usd,
        total_pending_ars=total_pending_ars,
        expenses_count=expenses_count,
        participants_count=participants_count,
        current_exchange_rate=current_rate,
    )


@router.get("/evolution", response_model=ExpenseEvolution)
async def get_expense_evolution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    project: Optional[Project] = Depends(get_project_from_header),
):
    """
    Get monthly expense evolution for the current project.
    """
    # Group expenses by year and month
    query = db.query(
        extract("year", Expense.expense_date).label("year"),
        extract("month", Expense.expense_date).label("month"),
        func.sum(Expense.amount_usd).label("total_usd"),
        func.sum(Expense.amount_ars).label("total_ars"),
        func.count(Expense.id).label("count"),
    )

    if project:
        query = query.filter(Expense.project_id == project.id)

    monthly_data = (
        query
        .group_by(
            extract("year", Expense.expense_date),
            extract("month", Expense.expense_date),
        )
        .order_by(
            extract("year", Expense.expense_date),
            extract("month", Expense.expense_date),
        )
        .all()
    )

    monthly_expenses = []
    cumulative_usd = Decimal("0")
    cumulative_ars = Decimal("0")

    for row in monthly_data:
        monthly_usd = Decimal(str(row.total_usd or 0))
        monthly_ars = Decimal(str(row.total_ars or 0))
        cumulative_usd += monthly_usd
        cumulative_ars += monthly_ars

        monthly_expenses.append(MonthlyExpense(
            year=int(row.year),
            month=int(row.month),
            total_usd=monthly_usd,
            total_ars=monthly_ars,
            expenses_count=row.count,
        ))

    return ExpenseEvolution(
        monthly_data=monthly_expenses,
        cumulative_usd=cumulative_usd,
        cumulative_ars=cumulative_ars,
    )


@router.get("/my-status", response_model=UserPaymentStatus)
async def get_my_payment_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current user's payment status summary.
    """
    summary = get_user_payment_summary(db, current_user.id)

    return UserPaymentStatus(
        user_id=current_user.id,
        user_name=current_user.full_name,
        participation_percentage=Decimal(str(current_user.participation_percentage)),
        total_due_usd=summary["total_due_usd"],
        total_due_ars=summary["total_due_ars"],
        total_paid_usd=summary["total_paid_usd"],
        total_paid_ars=summary["total_paid_ars"],
        pending_usd=summary["pending_usd"],
        pending_ars=summary["pending_ars"],
        pending_payments_count=summary["pending_payments_count"],
    )


@router.get("/all-users-status", response_model=List[UserPaymentStatus])
async def get_all_users_payment_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get payment status for all active participants.
    """
    users = (
        db.query(User)
        .filter(User.is_active == True)
        .filter(User.participation_percentage > 0)
        .all()
    )

    result = []
    for user in users:
        summary = get_user_payment_summary(db, user.id)
        result.append(UserPaymentStatus(
            user_id=user.id,
            user_name=user.full_name,
            participation_percentage=Decimal(str(user.participation_percentage)),
            total_due_usd=summary["total_due_usd"],
            total_due_ars=summary["total_due_ars"],
            total_paid_usd=summary["total_paid_usd"],
            total_paid_ars=summary["total_paid_ars"],
            pending_usd=summary["pending_usd"],
            pending_ars=summary["pending_ars"],
            pending_payments_count=summary["pending_payments_count"],
        ))

    return result


@router.get("/expense-status/{expense_id}", response_model=ExpensePaymentStatus)
async def get_expense_payment_status(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get detailed payment status for a specific expense.
    Shows which participants have paid and which are pending.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    payments = (
        db.query(ParticipantPayment)
        .filter(ParticipantPayment.expense_id == expense_id)
        .all()
    )

    participants = []
    paid_count = 0
    pending_count = 0

    for payment in payments:
        user = db.query(User).filter(User.id == payment.user_id).first()
        participants.append(ParticipantStatus(
            user_id=payment.user_id,
            user_name=user.full_name if user else "Unknown",
            amount_due_usd=Decimal(str(payment.amount_due_usd)),
            amount_due_ars=Decimal(str(payment.amount_due_ars)),
            is_pending_approval=payment.is_pending_approval,
            is_paid=payment.is_paid,
            paid_at=payment.paid_at,
            submitted_at=payment.submitted_at,
            rejection_reason=payment.rejection_reason,
        ))

        if payment.is_paid:
            paid_count += 1
        else:
            pending_count += 1

    return ExpensePaymentStatus(
        expense_id=expense.id,
        description=expense.description,
        total_amount_usd=Decimal(str(expense.amount_usd)),
        total_amount_ars=Decimal(str(expense.amount_ars)),
        participants=participants,
        fully_paid=pending_count == 0,
        paid_count=paid_count,
        pending_count=pending_count,
    )
