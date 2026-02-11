from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.expense import Expense, ExpenseStatus
from app.models.payment import ParticipantPayment
from app.models.project_member import ProjectMember
from app.models.project import Project


def get_active_participants(db: Session) -> List[User]:
    """Get all active participants with participation > 0 (legacy - use get_project_members for new code)."""
    return (
        db.query(User)
        .filter(User.is_active == True)
        .filter(User.participation_percentage > 0)
        .all()
    )


def get_project_members(db: Session, project_id: int) -> List[ProjectMember]:
    """Get all active project members with participation > 0."""
    return (
        db.query(ProjectMember)
        .join(User)
        .filter(ProjectMember.project_id == project_id)
        .filter(ProjectMember.is_active == True)
        .filter(User.is_active == True)
        .filter(ProjectMember.participation_percentage > 0)
        .all()
    )


def validate_participation_percentages(db: Session, project_id: Optional[int] = None) -> tuple[bool, Decimal]:
    """
    Validate that all active participants' percentages sum to 100.
    Returns (is_valid, total_percentage)
    """
    if project_id:
        members = get_project_members(db, project_id)
        total = sum(Decimal(str(m.participation_percentage)) for m in members)
    else:
        participants = get_active_participants(db)
        total = sum(Decimal(str(p.participation_percentage)) for p in participants)
    return (total == Decimal("100"), total)


def create_participant_payments(
    db: Session,
    expense: Expense,
    currency_mode: str = "DUAL",
) -> List[ParticipantPayment]:
    """
    Create payment records for all active project members based on their
    participation percentage.
    Payments are always created as pending - for individual projects,
    auto-approval happens when user submits payment.

    Currency mode determines which amounts are calculated:
    - ARS: only amount_due_ars, amount_due_usd = 0
    - USD: only amount_due_usd, amount_due_ars = 0
    - DUAL: both amounts (current behavior)
    """
    payments = []

    def calc_amounts(percentage):
        if currency_mode == "ARS":
            return (Decimal("0"), (Decimal(str(expense.amount_ars)) * percentage).quantize(Decimal("0.01")))
        elif currency_mode == "USD":
            return ((Decimal(str(expense.amount_usd)) * percentage).quantize(Decimal("0.01")), Decimal("0"))
        else:  # DUAL
            return (
                (Decimal(str(expense.amount_usd)) * percentage).quantize(Decimal("0.01")),
                (Decimal(str(expense.amount_ars)) * percentage).quantize(Decimal("0.01")),
            )

    # Use project members if expense has a project, otherwise fall back to global users
    if expense.project_id:
        members = get_project_members(db, expense.project_id)
        for member in members:
            percentage = Decimal(str(member.participation_percentage)) / Decimal("100")
            amount_due_usd, amount_due_ars = calc_amounts(percentage)

            payment = ParticipantPayment(
                expense_id=expense.id,
                user_id=member.user_id,
                amount_due_usd=amount_due_usd,
                amount_due_ars=amount_due_ars,
                is_paid=False,
            )
            db.add(payment)
            payments.append(payment)
    else:
        # Legacy: use global participants
        participants = get_active_participants(db)
        for participant in participants:
            percentage = Decimal(str(participant.participation_percentage)) / Decimal("100")
            amount_due_usd, amount_due_ars = calc_amounts(percentage)

            payment = ParticipantPayment(
                expense_id=expense.id,
                user_id=participant.id,
                amount_due_usd=amount_due_usd,
                amount_due_ars=amount_due_ars,
                is_paid=False,
            )
            db.add(payment)
            payments.append(payment)

    db.commit()

    # Refresh all payments to get IDs
    for payment in payments:
        db.refresh(payment)

    return payments


def update_expense_status(db: Session, expense_id: int) -> ExpenseStatus:
    """
    Update expense status based on payment status of all participants.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        return None

    payments = (
        db.query(ParticipantPayment)
        .filter(ParticipantPayment.expense_id == expense_id)
        .all()
    )

    if not payments:
        return expense.status

    paid_count = sum(1 for p in payments if p.is_paid)
    total_count = len(payments)

    if paid_count == 0:
        new_status = ExpenseStatus.PENDING
    elif paid_count == total_count:
        new_status = ExpenseStatus.PAID
    else:
        new_status = ExpenseStatus.PARTIAL

    expense.status = new_status
    db.commit()

    return new_status


def get_user_pending_payments(db: Session, user_id: int) -> List[ParticipantPayment]:
    """Get all pending payments for a user."""
    return (
        db.query(ParticipantPayment)
        .filter(ParticipantPayment.user_id == user_id)
        .filter(ParticipantPayment.is_paid == False)
        .all()
    )


def get_user_payment_summary(db: Session, user_id: int, project_id: Optional[int] = None) -> dict:
    """Get payment summary for a user, optionally filtered by project (excludes deleted payments and expenses)."""
    query = db.query(ParticipantPayment).filter(
        ParticipantPayment.user_id == user_id,
        ParticipantPayment.is_deleted == False,
    )

    if project_id:
        query = query.join(Expense).filter(
            Expense.project_id == project_id,
            Expense.is_deleted == False,
        )
    else:
        # Even without project filter, exclude deleted expenses
        query = query.join(Expense).filter(Expense.is_deleted == False)

    payments = query.all()

    total_due_usd = sum(Decimal(str(p.amount_due_usd)) for p in payments)
    total_due_ars = sum(Decimal(str(p.amount_due_ars)) for p in payments)

    paid_payments = [p for p in payments if p.is_paid]
    total_paid_usd = sum(Decimal(str(p.amount_due_usd)) for p in paid_payments)
    total_paid_ars = sum(Decimal(str(p.amount_due_ars)) for p in paid_payments)

    pending_usd = total_due_usd - total_paid_usd
    pending_ars = total_due_ars - total_paid_ars

    return {
        "total_due_usd": total_due_usd,
        "total_due_ars": total_due_ars,
        "total_paid_usd": total_paid_usd,
        "total_paid_ars": total_paid_ars,
        "pending_usd": pending_usd,
        "pending_ars": pending_ars,
        "pending_payments_count": len(payments) - len(paid_payments),
    }
