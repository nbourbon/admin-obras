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


def create_payments_current_account(
    db: Session,
    expense: Expense,
    currency_mode: str = "DUAL",
    payers: Optional[List[dict]] = None,
) -> List[ParticipantPayment]:
    """
    Create payment records for current_account projects.
    Expenses always deduct from balance. If balance is insufficient,
    payers must be specified to create inline unilateral contributions.

    Returns the list of ParticipantPayment records created.
    """
    from app.models.contribution import Contribution, ContributionStatus, Currency as ContribCurrency
    from app.models.contribution_payment import ContributionPayment

    members = get_project_members(db, expense.project_id)
    if not members:
        return []

    # Calculate amounts per member
    def calc_amounts(percentage):
        if currency_mode == "ARS":
            return (Decimal("0"), (Decimal(str(expense.amount_ars)) * percentage).quantize(Decimal("0.01")))
        elif currency_mode == "USD":
            return ((Decimal(str(expense.amount_usd)) * percentage).quantize(Decimal("0.01")), Decimal("0"))
        else:
            return (
                (Decimal(str(expense.amount_usd)) * percentage).quantize(Decimal("0.01")),
                (Decimal(str(expense.amount_ars)) * percentage).quantize(Decimal("0.01")),
            )

    member_amounts = []
    for member in members:
        percentage = Decimal(str(member.participation_percentage)) / Decimal("100")
        amount_due_usd, amount_due_ars = calc_amounts(percentage)
        member_amounts.append([member, amount_due_usd, amount_due_ars])

    # Rounding correction
    if member_amounts:
        diff_usd = Decimal(str(expense.amount_usd)) - sum(a[1] for a in member_amounts)
        diff_ars = Decimal(str(expense.amount_ars)) - sum(a[2] for a in member_amounts)
        if diff_usd != 0 or diff_ars != 0:
            max_idx = max(range(len(member_amounts)), key=lambda i: member_amounts[i][0].participation_percentage)
            member_amounts[max_idx][1] += diff_usd
            member_amounts[max_idx][2] += diff_ars

    # Check if total balance is sufficient
    total_balance = sum(Decimal(str(m.balance_ars)) for m in members)
    expense_amount = Decimal(str(expense.amount_ars)) if currency_mode != "USD" else Decimal(str(expense.amount_usd))

    if currency_mode == "USD":
        total_balance = sum(Decimal(str(m.balance_usd)) for m in members)

    balance_sufficient = total_balance >= expense_amount

    # If balance is NOT sufficient, we need payers
    if not balance_sufficient and not payers:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La caja no tiene saldo suficiente. Debe indicar quién pagó este gasto (campo 'payers').",
        )

    # If payers provided but balance still insufficient, validate payers cover the gap
    if not balance_sufficient and payers:
        from fastapi import HTTPException, status
        total_payer_credit = Decimal("0")
        for payer_info in payers:
            payer_amount = Decimal(str(payer_info["amount"]))
            if currency_mode == "USD":
                total_payer_credit += payer_amount
            elif currency_mode == "ARS":
                total_payer_credit += payer_amount
            else:  # DUAL — payer amount is in expense currency, convert to ARS
                if expense.currency_original.value == "USD" and expense.exchange_rate_used:
                    total_payer_credit += (payer_amount * Decimal(str(expense.exchange_rate_used))).quantize(Decimal("0.01"))
                else:
                    total_payer_credit += payer_amount

        if total_balance + total_payer_credit < expense_amount:
            shortage = expense_amount - total_balance - total_payer_credit
            currency_label = "USD" if currency_mode == "USD" else "ARS"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El aporte de los pagadores no cubre el gasto completo. Faltan {shortage:,.2f} {currency_label}.",
            )

    # If payers provided, create inline unilateral contributions first
    if payers:
        now = datetime.utcnow()
        for payer_info in payers:
            payer_user_id = payer_info["user_id"]
            payer_amount = Decimal(str(payer_info["amount"]))

            # Find the member
            payer_member = next((m for m in members if m.user_id == payer_user_id), None)
            if not payer_member:
                continue

            # Determine the amount to store in the contribution and credit to balance.
            # In DUAL mode, balance is always in ARS. Store the contribution in ARS too
            # so that absorption against ARS solicitudes works without currency conversion.
            if currency_mode == "USD":
                # Pure USD project: store in USD, credit balance_usd
                contrib_currency = ContribCurrency.USD
                contrib_amount = payer_amount
                balance_credit_ars = None
                balance_credit_usd = payer_amount
            elif currency_mode == "ARS":
                # Pure ARS project: store in ARS, credit balance_ars
                contrib_currency = ContribCurrency.ARS
                contrib_amount = payer_amount
                balance_credit_ars = payer_amount
                balance_credit_usd = None
            else:
                # DUAL mode: balance is in ARS only — convert payer amount to ARS
                contrib_currency = ContribCurrency.ARS
                if expense.currency_original.value == "USD" and expense.exchange_rate_used:
                    contrib_amount = (payer_amount * Decimal(str(expense.exchange_rate_used))).quantize(Decimal("0.01"))
                else:
                    contrib_amount = payer_amount
                balance_credit_ars = contrib_amount
                balance_credit_usd = None

            # Create unilateral contribution
            contribution = Contribution(
                description=f"Aporte por gasto: {expense.description}",
                amount=contrib_amount,
                currency=contrib_currency,
                project_id=expense.project_id,
                created_by=expense.created_by,
                status=ContributionStatus.APPROVED,
                is_unilateral=True,
                contributor_user_id=payer_user_id,
                expense_id=expense.id,
            )
            db.add(contribution)
            db.flush()

            # Create contribution payment (auto-approved)
            cp = ContributionPayment(
                contribution_id=contribution.id,
                user_id=payer_user_id,
                amount_due=contrib_amount,
                amount_paid=contrib_amount,
                is_paid=True,
                paid_at=now,
                payment_date=now,
                submitted_at=now,
                approved_at=now,
                approved_by=expense.created_by,
                currency_paid=contrib_currency.value,
            )
            if contrib_currency == ContribCurrency.USD:
                cp.amount_paid_usd = contrib_amount
                cp.amount_paid_ars = Decimal("0")
            else:
                cp.amount_paid_ars = contrib_amount
                cp.amount_paid_usd = Decimal("0")
            db.add(cp)

            # Credit balance
            if balance_credit_usd is not None:
                payer_member.balance_usd += balance_credit_usd
            if balance_credit_ars is not None:
                payer_member.balance_ars += balance_credit_ars
            payer_member.balance_updated_at = now

        db.flush()

    # Now deduct from all members proportionally (create auto-paid payments)
    payments = []
    now = datetime.utcnow()
    for member, amount_due_usd, amount_due_ars in member_amounts:
        payment = auto_pay_from_balance(
            db, expense, member, amount_due_usd, amount_due_ars, currency_mode
        )

        # Deduct from balance
        if currency_mode == "ARS":
            member.balance_ars -= amount_due_ars
        elif currency_mode == "USD":
            member.balance_usd -= amount_due_usd
        else:  # DUAL
            if hasattr(expense, 'currency_original') and expense.currency_original.value == "ARS":
                member.balance_ars -= amount_due_ars
            else:
                amount_due_ars_equivalent = amount_due_usd * expense.exchange_rate_used
                member.balance_ars -= amount_due_ars_equivalent

        member.balance_updated_at = now
        db.add(payment)
        payments.append(payment)

    db.flush()
    for payment in payments:
        db.refresh(payment)

    return payments


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

        # First pass: calculate amounts for all members
        member_amounts = []
        for member in members:
            percentage = Decimal(str(member.participation_percentage)) / Decimal("100")
            amount_due_usd, amount_due_ars = calc_amounts(percentage)
            member_amounts.append([member, amount_due_usd, amount_due_ars])

        # Rounding correction: assign leftover cent to the member with the highest %
        # This ensures sum(amount_due) == expense.amount exactly
        if member_amounts:
            diff_usd = Decimal(str(expense.amount_usd)) - sum(a[1] for a in member_amounts)
            diff_ars = Decimal(str(expense.amount_ars)) - sum(a[2] for a in member_amounts)
            if diff_usd != 0 or diff_ars != 0:
                max_idx = max(
                    range(len(member_amounts)),
                    key=lambda i: member_amounts[i][0].participation_percentage,
                )
                member_amounts[max_idx][1] += diff_usd
                member_amounts[max_idx][2] += diff_ars

        # Second pass: create payments with corrected amounts
        for member, amount_due_usd, amount_due_ars in member_amounts:
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

        # First pass: calculate amounts
        participant_amounts = []
        for participant in participants:
            percentage = Decimal(str(participant.participation_percentage)) / Decimal("100")
            amount_due_usd, amount_due_ars = calc_amounts(percentage)
            participant_amounts.append([participant, amount_due_usd, amount_due_ars])

        # Rounding correction
        if participant_amounts:
            diff_usd = Decimal(str(expense.amount_usd)) - sum(a[1] for a in participant_amounts)
            diff_ars = Decimal(str(expense.amount_ars)) - sum(a[2] for a in participant_amounts)
            if diff_usd != 0 or diff_ars != 0:
                max_idx = max(
                    range(len(participant_amounts)),
                    key=lambda i: participant_amounts[i][0].participation_percentage,
                )
                participant_amounts[max_idx][1] += diff_usd
                participant_amounts[max_idx][2] += diff_ars

        for participant, amount_due_usd, amount_due_ars in participant_amounts:
            payment = ParticipantPayment(
                expense_id=expense.id,
                user_id=participant.id,
                amount_due_usd=amount_due_usd,
                amount_due_ars=amount_due_ars,
                is_paid=False,
            )
            db.add(payment)
            payments.append(payment)

    db.flush()

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
    db.flush()

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
    Only includes EXPENSE payments (ParticipantPayment).
    Contribution payments are tracked separately via balance_aportes.
    Excludes deleted payments and expenses.
    """
    # Query ParticipantPayment (expense payments ONLY)
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

    # Sum expense payments (have amount_due_usd and amount_due_ars)
    total_due_usd = sum(Decimal(str(p.amount_due_usd)) for p in expense_payments)
    total_due_ars = sum(Decimal(str(p.amount_due_ars)) for p in expense_payments)

    paid_expense_payments = [p for p in expense_payments if p.is_paid]
    total_paid_usd = sum(Decimal(str(p.amount_due_usd)) for p in paid_expense_payments)
    total_paid_ars = sum(Decimal(str(p.amount_due_ars)) for p in paid_expense_payments)

    # NOTE: Contributions are NOT included in pending calculations
    # Contributions are credits (user adds money to fund), not debts
    # They are tracked separately via balance_aportes in ProjectMember

    pending_usd = total_due_usd - total_paid_usd
    pending_ars = total_due_ars - total_paid_ars

    total_pending_count = len([p for p in expense_payments if not p.is_paid])

    return {
        "total_due_usd": total_due_usd,
        "total_due_ars": total_due_ars,
        "total_paid_usd": total_paid_usd,
        "total_paid_ars": total_paid_ars,
        "pending_usd": pending_usd,
        "pending_ars": pending_ars,
        "pending_payments_count": total_pending_count,
    }
