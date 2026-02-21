from decimal import Decimal
from typing import List, Optional
from datetime import datetime
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


def check_sufficient_balance(
    member: ProjectMember,
    amount_due_usd: Decimal,
    amount_due_ars: Decimal,
    currency_mode: str,
    expense: Expense,
) -> bool:
    """
    Check if member has sufficient balance to auto-pay the expense.
    Logic "todo o nada": only returns True if balance covers 100% of the amount.

    Currency mode logic:
    - ARS: check balance_ars >= amount_due_ars
    - USD: check balance_usd >= amount_due_usd
    - DUAL: balance is stored ONLY in ARS
        - If expense is in ARS: check balance_ars >= amount_due_ars
        - If expense is in USD: convert amount_due_usd to ARS using expense's TC and check balance_ars
    """
    if currency_mode == "ARS":
        return member.balance_ars >= amount_due_ars
    elif currency_mode == "USD":
        return member.balance_usd >= amount_due_usd
    else:  # DUAL
        # In DUAL mode, balance is ONLY in ARS
        # We need to check if the ARS balance covers the amount due

        # If expense was in ARS
        if hasattr(expense, 'currency_original') and expense.currency_original.value == "ARS":
            return member.balance_ars >= amount_due_ars
        # If expense was in USD, convert to ARS using expense's TC
        else:
            amount_due_ars_equivalent = amount_due_usd * expense.exchange_rate_used
            return member.balance_ars >= amount_due_ars_equivalent


def auto_pay_from_balance(
    db: Session,
    expense: Expense,
    member: ProjectMember,
    amount_due_usd: Decimal,
    amount_due_ars: Decimal,
    currency_mode: str,
) -> ParticipantPayment:
    """
    Create an auto-paid payment record and deduct from member's balance.

    Returns the payment record already marked as paid and approved.
    The balance deduction happens in the calling function.
    """
    now = datetime.utcnow()

    # Determine which amount to use as amount_paid
    if currency_mode == "USD":
        amount_paid = amount_due_usd
        currency_paid = "USD"
    else:
        amount_paid = amount_due_ars
        currency_paid = "ARS"

    payment = ParticipantPayment(
        expense_id=expense.id,
        user_id=member.user_id,
        amount_due_usd=amount_due_usd,
        amount_due_ars=amount_due_ars,
        amount_paid=amount_paid,
        currency_paid=currency_paid,
        is_paid=True,
        paid_at=now,
        payment_date=now,
        submitted_at=now,
        approved_at=now,
        approved_by=expense.created_by,
        exchange_rate_at_payment=expense.exchange_rate_used,
        amount_paid_usd=amount_due_usd,
        amount_paid_ars=amount_due_ars,
        exchange_rate_source=expense.exchange_rate_source,
    )

    return payment


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

            # NEW LOGIC: Check if member has sufficient balance to auto-pay
            has_sufficient_balance = check_sufficient_balance(
                member, amount_due_usd, amount_due_ars, currency_mode, expense
            )

            if has_sufficient_balance:
                # Auto-pay from balance
                payment = auto_pay_from_balance(
                    db, expense, member, amount_due_usd, amount_due_ars, currency_mode
                )

                # Deduct from balance according to currency_mode
                if currency_mode == "ARS":
                    member.balance_ars -= amount_due_ars
                elif currency_mode == "USD":
                    member.balance_usd -= amount_due_usd
                else:  # DUAL
                    # In DUAL mode, balance is stored ONLY in ARS
                    if hasattr(expense, 'currency_original') and expense.currency_original.value == "ARS":
                        member.balance_ars -= amount_due_ars
                    else:  # Expense was in USD
                        # Convert to ARS to deduct
                        amount_due_ars_equivalent = amount_due_usd * expense.exchange_rate_used
                        member.balance_ars -= amount_due_ars_equivalent

                member.balance_updated_at = datetime.utcnow()
            else:
                # Normal flow: create pending payment
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
    """
    Get payment summary for a user, optionally filtered by project.
    Includes BOTH expense payments (ParticipantPayment) AND contribution payments (ContributionPayment).
    Excludes deleted payments and expenses.
    """
    from app.models.contribution_payment import ContributionPayment
    from app.models.contribution import Contribution

    # Query ParticipantPayment (expense payments)
    expense_payments_query = db.query(ParticipantPayment).filter(
        ParticipantPayment.user_id == user_id,
        ParticipantPayment.is_deleted == False,
    )

    if project_id:
        expense_payments_query = expense_payments_query.join(Expense).filter(
            Expense.project_id == project_id,
            Expense.is_deleted == False,
        )
    else:
        # Even without project filter, exclude deleted expenses
        expense_payments_query = expense_payments_query.join(Expense).filter(Expense.is_deleted == False)

    expense_payments = expense_payments_query.all()

    # Query ContributionPayment (contribution payments)
    contribution_payments_query = db.query(ContributionPayment).join(Contribution).filter(
        ContributionPayment.user_id == user_id,
    )

    if project_id:
        contribution_payments_query = contribution_payments_query.filter(
            Contribution.project_id == project_id,
        )

    contribution_payments = contribution_payments_query.all()

    # Sum expense payments (have amount_due_usd and amount_due_ars)
    total_due_usd = sum(Decimal(str(p.amount_due_usd)) for p in expense_payments)
    total_due_ars = sum(Decimal(str(p.amount_due_ars)) for p in expense_payments)

    paid_expense_payments = [p for p in expense_payments if p.is_paid]
    total_paid_usd = sum(Decimal(str(p.amount_due_usd)) for p in paid_expense_payments)
    total_paid_ars = sum(Decimal(str(p.amount_due_ars)) for p in paid_expense_payments)

    # Sum contribution payments (have amount_due + currency from parent Contribution)
    for cp in contribution_payments:
        contribution = cp.contribution
        if contribution.currency.value == "USD":
            total_due_usd += Decimal(str(cp.amount_due))
            if cp.is_paid:
                total_paid_usd += Decimal(str(cp.amount_due))
        else:  # ARS
            total_due_ars += Decimal(str(cp.amount_due))
            if cp.is_paid:
                total_paid_ars += Decimal(str(cp.amount_due))

    pending_usd = total_due_usd - total_paid_usd
    pending_ars = total_due_ars - total_paid_ars

    total_pending_count = (
        len([p for p in expense_payments if not p.is_paid]) +
        len([cp for cp in contribution_payments if not cp.is_paid])
    )

    return {
        "total_due_usd": total_due_usd,
        "total_due_ars": total_due_ars,
        "total_paid_usd": total_paid_usd,
        "total_paid_ars": total_paid_ars,
        "pending_usd": pending_usd,
        "pending_ars": pending_ars,
        "pending_payments_count": total_pending_count,
    }
